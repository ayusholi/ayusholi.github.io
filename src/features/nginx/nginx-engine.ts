// =========================================================
// Nginx as a reverse proxy, as a pure state model. No DOM, no timers.
//
// Models what lets one server hold thousands of connections: a few
// event-driven workers that keep idle connections for a few hundred
// bytes each, against a thread-per-connection server that runs out of
// threads. Also models static files served from disk, round-robin load
// balancing, an upstream that refuses connections (retried, then
// marked down), and response buffering for a slow client.
// See nginx-engine.test.ts.
//
// Simplified on purpose: requests run one at a time, max_fails is 1,
// and timings and memory are round, illustrative numbers.
// =========================================================

import type { Packet } from "@/lib/simulation/simulation-types";
import type { NginxConfig, NginxEventType, NginxFrame, NginxNodeId, NginxState, Req, RequestKind, Upstream } from "./nginx-types";

export const UPSTREAMS: Upstream[] = ["app1", "app2", "app3"];
export const PATHS: Record<RequestKind, string> = { page: "/orders", static: "/static/logo.png", slow: "/orders" };

export const WORKERS = 4;
export const WORKER_CONNECTIONS = 16384;
export const THREADS = 400;          // a thread-per-connection server's pool
export const BURST = 10000;          // idle keep-alive connections, e.g. phones between taps
export const BASE_MB = 10;                 // the server itself, before any connections
const IDLE_MB = 0.00025;             // nginx.org: 10,000 idle keep-alive connections ≈ 2.5 MB
const THREAD_MB = 1;                 // one stack per thread
export const APP_MS = 40;            // the app's time to build /orders
export const SLOW_MS = 3000;         // a phone on a weak signal, downloading the response

// Connections each model can hold at once, and what they cost.
export const capacity = (s: Pick<NginxState, "model">) => (s.model === "event" ? WORKERS * WORKER_CONNECTIONS : THREADS);
const held = (s: NginxState) => Math.min(s.idle, capacity(s));
const memory = (s: NginxState) => Math.round((BASE_MB + (s.model === "event" ? held(s) * IDLE_MB : held(s) * THREAD_MB)) * 10) / 10;
const withConnections = (s: NginxState): NginxState => ({ ...s, stats: { ...s.stats, connections: held(s), waiting: s.idle - held(s), memoryMb: memory(s) } });

export const createState = (patch: NginxConfig = {}): NginxState => withConnections({
  model: "event",
  buffering: "on",
  upstreams: { app1: { up: true, marked: false, served: 0 }, app2: { up: true, marked: false, served: 0 }, app3: { up: true, marked: false, served: 0 } },
  rr: 0,
  idle: 0,
  requests: [],
  next: 1,
  stats: { requests: 0, errors: 0, retries: 0, connections: 0, waiting: 0, memoryMb: 0, appBusyMs: 0 },
  ...patch,
});

const packet = (from: NginxNodeId, to: NginxNodeId, label: string, kind: Packet["kind"] = "request"): Packet<NginxNodeId> => ({ from, to, label, kind });

const chain = (state: NginxState) => {
  let s = state;
  const frames: NginxFrame[] = [];
  const step = (type: NginxEventType, at: NginxNodeId, packets: Packet<NginxNodeId>[], patch: (st: NginxState) => NginxState = (st) => st, meta: Partial<NginxFrame> = {}) => {
    s = patch(s);
    frames.push({ type, state: s, packets, at, dur: 700, ...meta });
  };
  return { step, get state() { return s; }, frames };
};

const stat = (s: NginxState, key: keyof NginxState["stats"], by = 1): NginxState => ({ ...s, stats: { ...s.stats, [key]: s.stats[key] + by } });
// Updates the request in flight.
const current = (s: NginxState, patch: Partial<Req>): NginxState => ({
  ...s, requests: s.requests.map((r, i) => (i === s.requests.length - 1 ? { ...r, ...patch } : r)),
});
const upstream = (s: NginxState, id: Upstream, patch: Partial<NginxState["upstreams"][Upstream]>): NginxState => ({
  ...s, upstreams: { ...s.upstreams, [id]: { ...s.upstreams[id], ...patch } },
});

// ---------- Idle connections ----------
// Thousands of clients connect and then mostly wait: keep-alive between page loads.
export const burst = (state: NginxState): NginxFrame[] => {
  const c = chain(state);
  c.step("burst.arrived", "clients", [packet("clients", "nginx", `${BURST.toLocaleString("en")} × connect`)], (s) => ({ ...s, idle: s.idle + BURST }));
  c.step(c.state.model === "event" ? "burst.held" : "burst.threads", "nginx", [], withConnections, { dur: 1000 });
  return c.frames;
};

// ---------- One request ----------
export const request = (state: NginxState, kind: RequestKind): NginxFrame[] => {
  const c = chain(state);
  const path = PATHS[kind];
  const req: Req = { n: state.next, kind, path, tried: [], upstream: null, status: "running", ms: 0 };
  c.step("accepted", "nginx", [packet("clients", "nginx", `GET ${path}`)], (s) => ({ ...stat(s, "requests"), next: s.next + 1, requests: [...s.requests, req].slice(-8) }));

  // Every thread is parked on an idle connection, so this one waits its turn until it gives up.
  if (c.state.model === "threads" && c.state.idle >= THREADS) {
    c.step("queued", "nginx", [], (s) => s, { dur: 900 });
    c.step("timed.out", "clients", [packet("nginx", "clients", "timeout", "error")], (s) => stat(current(s, { status: "timeout", ms: 60000 }), "errors"));
    return c.frames;
  }

  if (kind === "static") {
    c.step("static.read", "disk", [packet("nginx", "disk", "logo.png")]);
    c.step("responded", "clients", [packet("disk", "nginx", "bytes", "value"), packet("nginx", "clients", "200", "value")], (s) => current(s, { status: "200", ms: 1 }));
    return c.frames;
  }

  // Round robin, skipping upstreams already marked down; a refused connection moves on to the next.
  for (let k = 0; k < UPSTREAMS.length; k++) {
    const i = (c.state.rr + k) % UPSTREAMS.length;
    const id = UPSTREAMS[i] as Upstream;
    if (c.state.upstreams[id].marked) continue;
    c.step("proxied", id, [packet("nginx", id, `GET ${path}`, "command")], (s) => current(s, { tried: [...(s.requests[s.requests.length - 1]?.tried ?? []), id] }), { app: id });
    if (!c.state.upstreams[id].up) {
      c.step("upstream.refused", "nginx", [packet(id, "nginx", "refused", "error")], (s) => stat(upstream(s, id, { marked: true }), "retries"), { app: id });
      continue;
    }
    const busy = kind === "slow" && c.state.buffering === "off" ? SLOW_MS : APP_MS;
    c.step("upstream.ok", "nginx", [packet(id, "nginx", "200", "value")], (s) => ({
      ...stat(upstream(current(s, { upstream: id }), id, { served: s.upstreams[id].served + 1 }), "appBusyMs", busy), rr: (i + 1) % UPSTREAMS.length,
    }), { app: id });
    if (kind === "slow") c.step(c.state.buffering === "on" ? "buffered" : "unbuffered", "nginx", [], (s) => s, { app: id, dur: 900 });
    const retries = c.state.requests[c.state.requests.length - 1]?.tried.length ?? 1;
    c.step("responded", "clients", [packet("nginx", "clients", "200", "value")], (s) => current(s, { status: "200", ms: (kind === "slow" ? SLOW_MS : APP_MS) + retries - 1 }), { app: id });
    return c.frames;
  }

  c.step("no.live", "clients", [packet("nginx", "clients", "502", "error")], (s) => stat(current(s, { status: "502", ms: 1 }), "errors"));
  return c.frames;
};

// An app server crashes, or comes back. Coming back clears the mark, as fail_timeout passing would.
export const toggle = (state: NginxState, id: Upstream): NginxFrame[] => {
  const up = !state.upstreams[id].up;
  return [{ type: up ? "app.up" : "app.down", state: upstream(state, id, up ? { up, marked: false } : { up }), packets: [], at: id, app: id, dur: 600 }];
};

export const configure = (state: NginxState, patch: NginxConfig): NginxFrame[] => [{ type: "config.changed", state: withConnections({ ...state, ...patch }), packets: [], dur: 1, patch }];

export const runAll = (state: NginxState, ...actions: ((s: NginxState) => NginxFrame[] | null)[]) => {
  let s = state;
  const frames: NginxFrame[] = [];
  for (const action of actions) {
    const out = action(s) ?? [];
    frames.push(...out);
    s = out[out.length - 1]?.state ?? s;
  }
  return { state: s, frames };
};
