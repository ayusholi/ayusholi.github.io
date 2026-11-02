// =========================================================
// A Kubernetes Deployment, as a pure state model. No DOM, no timers.
//
// Nothing here is told to *do* anything. kubectl writes desired
// state to the API server, and independent control loops (the
// Deployment controller, the scheduler, one kubelet per node, and
// the node lifecycle controller) each compare what they can see
// with what should be true and fix one difference. They never
// talk to each other, only to the API server.
// See kubernetes-engine.test.ts.
//
// Simplified on purpose: one Deployment, pods that need one slot
// each, a rolling update with maxSurge 1 and maxUnavailable 0,
// eviction as soon as a node is declared lost, and a tick in place
// of real timeouts (which are tens of seconds to minutes).
// =========================================================

import type { Packet } from "@/lib/simulation/simulation-types";
import type { K8sEvent, K8sEventType, K8sFrame, K8sNodeId, K8sState, Pod, Version, Worker, WorkerId } from "./kubernetes-types";

export const CAPACITY = 3;            // pods per node
export const MAX_REPLICAS = 10;
export const NOT_READY_AFTER = 2;     // silent ticks before a node is marked NotReady
export const EVICT_AFTER = 4;         // silent ticks before its pods are replaced
export const MAX_PULLS = 3;           // image pull attempts shown before backing off quietly
export const MAX_SURGE = 1;
export const MAX_UNAVAILABLE = 0;
export const BROKEN: Version = "v3";

export const WORKERS: WorkerId[] = ["node1", "node2", "node3"];

export const createState = ({ desired = 3, version = "v1" }: { desired?: number; version?: Version } = {}): K8sState => ({
  desired,
  version,
  previous: null,
  pods: [],
  workers: WORKERS.map((id) => ({ id, up: true, ready: true, silent: 0 })),
  nextPod: 1,
  tick: 0,
  events: [],
  stats: { created: 0, evicted: 0 },
});

// ---------- Queries ----------
export const live = (s: K8sState) => s.pods.filter((p) => p.phase !== "Terminating");
export const worker = (s: K8sState, id: WorkerId | null) => s.workers.find((w) => w.id === id);
export const reportedReady = (s: K8sState) => live(s).filter((p) => p.ready).length;
// Ready according to the API server, *and* on a machine that is really there.
export const serving = (s: K8sState) => live(s).filter((p) => p.ready && worker(s, p.node)?.up).length;
export const pending = (s: K8sState) => live(s).filter((p) => !p.node).length;
export const load = (s: K8sState, id: WorkerId) => s.pods.filter((p) => p.node === id).length;
export const rollingOut = (s: K8sState) => live(s).some((p) => p.version !== s.version);

const packet = (from: K8sNodeId, to: K8sNodeId, label: string, kind: Packet["kind"] = "request"): Packet<K8sNodeId> => ({ from, to, label, kind });
const frame = (type: K8sEventType, state: K8sState, meta: Partial<K8sFrame> = {}): K8sFrame => ({ type, state, packets: [], dur: 650, ...meta });

const log = (s: K8sState, ...events: Omit<K8sEvent, "tick">[]): K8sState => ({ ...s, events: [...s.events, ...events.map((e) => ({ tick: s.tick, ...e }))].slice(-12) });
const setPod = (s: K8sState, name: string, patch: Partial<Pod>): K8sState => ({ ...s, pods: s.pods.map((p) => (p.name === name ? { ...p, ...patch } : p)) });
const setWorker = (s: K8sState, id: WorkerId, patch: Partial<Worker>): K8sState => ({ ...s, workers: s.workers.map((w) => (w.id === id ? { ...w, ...patch } : w)) });

// ---------- kubectl: every command only writes desired state ----------
export const scale = (state: K8sState, desired: number): K8sFrame[] => {
  const n = Math.max(1, Math.min(MAX_REPLICAS, desired));
  return [frame("spec.scaled", { ...state, desired: n }, { at: "api", count: n, packets: [packet("kubectl", "api", `replicas: ${n}`)] })];
};

export const setImage = (state: K8sState, version: Version): K8sFrame[] => {
  if (version === state.version) return [];
  return [frame("spec.image", { ...state, version, previous: state.version }, { at: "api", packets: [packet("kubectl", "api", `image: ${version}`)] })];
};

export const undo = (state: K8sState): K8sFrame[] => {
  if (!state.previous) return [];
  return [frame("spec.undo", { ...state, version: state.previous, previous: state.version }, { at: "api", packets: [packet("kubectl", "api", "rollout undo")] })];
};

export const deletePod = (state: K8sState, name?: string): K8sFrame[] => {
  const pod = name ? state.pods.find((p) => p.name === name) : live(state).find((p) => p.ready) ?? live(state)[0];
  if (!pod || pod.phase === "Terminating") return [];
  const s = pod.node ? setPod(state, pod.name, { phase: "Terminating", ready: false }) : { ...state, pods: state.pods.filter((p) => p !== pod) };
  return [frame("pod.deleted", s, { at: "api", pods: [pod.name], packets: [packet("kubectl", "api", `delete ${pod.name}`, "error")] })];
};

// A machine dying sends nothing. The control plane only notices the silence.
export const failNode = (state: K8sState, id: WorkerId): K8sFrame[] =>
  worker(state, id)?.up ? [frame("node.failed", setWorker(state, id, { up: false }), { at: id, worker: id, dur: 700 })] : [];

export const restoreNode = (state: K8sState, id: WorkerId): K8sFrame[] =>
  worker(state, id)?.up ? [] : [frame("node.restored", setWorker(state, id, { up: true }), { at: id, worker: id })];

// ---------- Control loops ----------
// Node lifecycle controller: notices missing heartbeats, then gives up on a node.
const nodeLifecycle = (s: K8sState): K8sFrame | null => {
  const back = s.workers.find((w) => w.up && !w.ready);
  if (back) {
    // It comes back empty: anything it was running has been replaced elsewhere.
    const next = log(setWorker({ ...s, pods: s.pods.filter((p) => p.node !== back.id) }, back.id, { ready: true, silent: 0 }), { warning: false, reason: "NodeReady", object: back.id, message: "Kubelet is posting ready status" });
    return frame("node.rejoined", next, { at: "api", worker: back.id, packets: [packet(back.id, "api", "heartbeat", "value")] });
  }
  const quiet = s.workers.find((w) => !w.up && w.silent < EVICT_AFTER);
  if (!quiet) return null;
  const silent = quiet.silent + 1;
  let next = setWorker(s, quiet.id, { silent });
  if (silent === NOT_READY_AFTER) {
    next = log(setWorker(next, quiet.id, { ready: false }), { warning: true, reason: "NodeNotReady", object: quiet.id, message: "Kubelet stopped posting node status" });
    next = { ...next, pods: next.pods.map((p) => (p.node === quiet.id ? { ...p, ready: false } : p)) };
    return frame("node.notready", next, { at: "api", worker: quiet.id });
  }
  if (silent === EVICT_AFTER) {
    const gone = next.pods.filter((p) => p.node === quiet.id);
    next = log({ ...next, pods: next.pods.filter((p) => p.node !== quiet.id), stats: { ...next.stats, evicted: next.stats.evicted + gone.filter((p) => p.phase !== "Terminating").length } },
      { warning: true, reason: "TaintManagerEviction", object: quiet.id, message: `Evicting ${gone.length} pod${gone.length === 1 ? "" : "s"}` });
    return frame("pods.evicted", next, { at: "api", worker: quiet.id, pods: gone.map((p) => p.name) });
  }
  return frame("node.silent", next, { at: "api", worker: quiet.id, count: silent, dur: 500 });
};

// Kubelets: each one makes its own node's containers match the pods bound to it.
const kubelets = (s: K8sState): K8sFrame | null => {
  let next = s;
  const packets: Packet<K8sNodeId>[] = [];
  for (const w of s.workers) {
    if (!w.up) continue;
    const said: string[] = [];
    for (const p of s.pods.filter((x) => x.node === w.id)) {
      if (p.phase === "Terminating") { next = { ...next, pods: next.pods.filter((x) => x.name !== p.name) }; said.push("stopped"); }
      else if (p.phase === "Pending" && p.version === BROKEN) {
        next = log(setPod(next, p.name, { phase: "ImagePullBackOff", retries: 1 }), { warning: true, reason: "Failed", object: p.name, message: `Failed to pull image "web:${p.version}": not found` });
        said.push("ErrImagePull");
      }
      else if (p.phase === "Pending") { next = setPod(next, p.name, { phase: "ContainerCreating" }); said.push("pulling"); }
      else if (p.phase === "ContainerCreating") {
        next = log(setPod(next, p.name, { phase: "Running" }), { warning: false, reason: "Started", object: p.name, message: `Started container web:${p.version}` });
        said.push("Running");
      }
      else if (p.phase === "Running" && !p.ready) { next = setPod(next, p.name, { ready: true }); said.push("Ready"); }
      else if (p.phase === "ImagePullBackOff" && p.retries < MAX_PULLS) { next = setPod(next, p.name, { retries: p.retries + 1 }); said.push("BackOff"); }
    }
    if (said.length) packets.push(packet(w.id, "api", said.length > 1 ? `${said.length} updates` : said[0] as string, said.some((x) => x === "ErrImagePull" || x === "BackOff") ? "error" : "value"));
  }
  return packets.length ? frame("kubelet.sync", next, { at: packets[0]?.from, packets }) : null;
};

// Scheduler: picks a node for every pod that has none. It trusts what the API
// server believes, so a dead node that hasn't been noticed yet still gets work.
const scheduler = (s: K8sState): K8sFrame[] => {
  let next = s;
  const bound: string[] = [];
  const stuck: string[] = [];
  for (const p of live(s).filter((x) => !x.node)) {
    const fits = next.workers.filter((w) => w.ready && load(next, w.id) < CAPACITY);
    const target = fits.sort((a, b) => load(next, a.id) - load(next, b.id))[0];
    if (target) {
      next = log(setPod(next, p.name, { node: target.id, unschedulable: false }), { warning: false, reason: "Scheduled", object: p.name, message: `Assigned to ${target.id}` });
      bound.push(`${p.name}>${target.id}`);
    } else if (!p.unschedulable) {
      next = log(setPod(next, p.name, { unschedulable: true }), { warning: true, reason: "FailedScheduling", object: p.name, message: `0/3 nodes available: ${next.workers.some((w) => !w.ready) ? "1 node not ready, " : ""}insufficient capacity` });
      stuck.push(p.name);
    }
  }
  const out: K8sFrame[] = [];
  if (bound.length) out.push(frame("pods.scheduled", next, { at: "scheduler", pods: bound.map((b) => b.split(">")[0] as string), packets: bound.map((b) => packet("scheduler", "api", `bind → ${b.split(">")[1]}`, "command")) }));
  if (stuck.length) out.push(frame("pods.unschedulable", next, { at: "scheduler", pods: stuck, packets: [packet("scheduler", "api", "no room", "error")] }));
  return out;
};

const newPods = (s: K8sState, count: number): K8sState => {
  const pods: Pod[] = Array.from({ length: count }, (_, i) => ({ name: `web-${s.nextPod + i}`, version: s.version, node: null, phase: "Pending", ready: false, born: s.tick, retries: 0, unschedulable: false }));
  return log({ ...s, pods: [...s.pods, ...pods], nextPod: s.nextPod + count, stats: { ...s.stats, created: s.stats.created + count } },
    ...pods.map((p) => ({ warning: false, reason: "SuccessfulCreate", object: "replicaset/web", message: `Created pod ${p.name}` })));
};

const terminate = (s: K8sState, victims: Pod[]): K8sState => {
  let next = s;
  for (const p of victims) {
    next = p.node ? setPod(next, p.name, { phase: "Terminating", ready: false }) : { ...next, pods: next.pods.filter((x) => x.name !== p.name) };
    next = log(next, { warning: false, reason: "SuccessfulDelete", object: "replicaset/web", message: `Deleted pod ${p.name}` });
  }
  return next;
};

// Least useful first: not yet placed, then not ready, then the newest.
const byExpendable = (a: Pod, b: Pod) => Number(!!a.node) - Number(!!b.node) || Number(a.ready) - Number(b.ready) || b.born - a.born;

// Deployment controller: compares the pods that exist with the spec.
const deployment = (s: K8sState): K8sFrame[] => {
  const pods = live(s);
  const current = pods.filter((p) => p.version === s.version);
  const old = pods.filter((p) => p.version !== s.version);
  const out: K8sFrame[] = [];
  let next = s;

  if (!old.length) {
    if (current.length < s.desired) {
      const n = s.desired - current.length;
      next = newPods(next, n);
      out.push(frame("pods.created", next, { at: "controller", count: n, packets: [packet("controller", "api", `create ×${n}`, "command")] }));
    } else if (current.length > s.desired) {
      const victims = [...current].sort(byExpendable).slice(0, current.length - s.desired);
      next = terminate(next, victims);
      out.push(frame("pods.removed", next, { at: "controller", pods: victims.map((p) => p.name), packets: [packet("controller", "api", `delete ×${victims.length}`, "error")] }));
    }
    return out;
  }

  // A rolling update: add new pods, but never more than MAX_SURGE above the
  // desired count, and remove old ones only while enough pods stay ready.
  const room = Math.min(s.desired - current.length, s.desired + MAX_SURGE - pods.length);
  if (room > 0) {
    next = newPods(next, room);
    out.push(frame("pods.created", next, { at: "controller", count: room, packets: [packet("controller", "api", `create ${s.version}`, "command")] }));
  }
  let ready = reportedReady(next);
  let total = live(next).length;
  const victims: Pod[] = [];
  for (const p of [...old].sort(byExpendable)) {
    // An old pod that isn't serving can always go. A serving one only when
    // there's a surplus and enough others are ready to cover for it.
    if (p.ready && (total <= s.desired || ready - 1 < s.desired - MAX_UNAVAILABLE)) break;
    victims.push(p);
    total--;
    if (p.ready) ready--;
  }
  if (victims.length) {
    next = terminate(next, victims);
    out.push(frame("pods.removed", next, { at: "controller", pods: victims.map((p) => p.name), packets: [packet("controller", "api", `delete ${victims[0]?.version}`, "error")] }));
  }
  return out;
};

// One round of every control loop, each acting on what the previous one left.
// Returns null when nothing would change: the cluster has converged.
export const tick = (state: K8sState): K8sFrame[] | null => {
  let s = { ...state, tick: state.tick + 1 };
  const frames: K8sFrame[] = [];
  const take = (made: K8sFrame | K8sFrame[] | null) => {
    for (const f of [made ?? []].flat()) { frames.push(f); s = f.state; }
  };
  take(nodeLifecycle(s));
  take(kubelets(s));
  take(scheduler(s));
  take(deployment(s));
  return frames.length ? frames : null;
};

export const lastState = (frames: K8sFrame[], fallback: K8sState) => frames[frames.length - 1]?.state ?? fallback;

// Tick until the loops have nothing left to do.
export const converge = (state: K8sState, limit = 200) => {
  let s = state;
  for (let i = 0; i < limit; i++) {
    const out = tick(s);
    if (!out) break;
    s = lastState(out, s);
  }
  return s;
};

export const ticks = (state: K8sState, count: number) => {
  let s = state;
  for (let i = 0; i < count; i++) s = lastState(tick(s) ?? [], s);
  return s;
};
