// =========================================================
// Redis cache-aside simulation. Pure: no DOM, no timers.
//
// Each action takes a state and returns frames. A frame holds the
// state after one transition plus what moved during it, so the view
// never decides what happened. Shared by the Redis topic and the
// publication's homepage. See redis-engine.test.ts.
//
// Simplified on purpose: one application process, one Redis node,
// one Postgres, and a clock that only moves when told to.
// =========================================================

import type { Packet, PacketKind } from "@/lib/simulation/simulation-types";
import type {
  CacheEntry, Latency, RedisAction, RedisConfig, RedisEventType, RedisFrame, RedisNodeId, RedisState, RedisStats,
  RequestStatus, SegmentKind, UserRecord,
} from "./redis-types";

// Illustrative one-way hop costs, in milliseconds. They are chosen to
// give 5 ms and 150 ms for the two paths, not measured from anything.
export const LATENCY: Latency = { client: 2, edge: 1, redis: 0.5, db: 72, redisTimeout: 50 };

export const RECORDS: Record<string, UserRecord> = {
  "user:42": { name: "Asha", plan: "free", version: 1 },
  "user:7": { name: "Bikram", plan: "pro", version: 1 },
};

type RedisOptions = Partial<Pick<RedisState, "ttl" | "policy" | "invalidation" | "edge" | "latency">>;

export const createState = ({ ttl = 60, policy = "fallback", invalidation = "delete", edge = false, latency = LATENCY }: RedisOptions = {}): RedisState => ({
  now: 0,                // simulated milliseconds
  ttl,                   // seconds
  policy,                // "fallback" | "strict"
  invalidation,          // "delete" | "none"
  edge,                  // route through Nginx (homepage only)
  latency,
  redisUp: true,
  db: structuredClone(RECORDS),
  cache: {},             // key -> { value, storedAt, expiresAt }
  stats: { requests: 0, hits: 0, misses: 0, dbQueries: 0, failed: 0, stale: 0 },
  history: [],           // finished requests, newest last
  log: [],               // commands as they would appear on the wire
  req: null,             // the request in flight
});

const HISTORY_LIMIT = 8;
const LOG_LIMIT = 14;

export const isLive = (entry: CacheEntry | undefined, now: number) => !!entry && now < entry.expiresAt;
export const ttlLeft = (entry: CacheEntry, now: number) => Math.max(0, Math.ceil((entry.expiresAt - now) / 1000));
const show = (value: UserRecord) => `{name:"${value.name}",plan:"${value.plan}"}`;

// Collects frames while threading the state through each transition.
type Meta = Partial<Omit<RedisFrame, "type" | "state">>;
type Recorder = { emit: (type: RedisEventType, patch: ((s: RedisState) => Partial<RedisState>) | null, meta?: Meta) => void; frames: RedisFrame[]; readonly state: RedisState };

const recorder = (initial: RedisState): Recorder => {
  let state = initial;
  const frames: RedisFrame[] = [];
  const emit: Recorder["emit"] = (type, patch, meta = {}) => {
    state = patch ? { ...state, ...patch(state) } : state;
    frames.push({ type, state, packets: [], dur: 620, ...meta });
  };
  return { emit, frames, get state() { return state; } };
};

const addLog = (s: RedisState, cmd: string, reply: string) => ({ log: [...s.log, { cmd, reply }].slice(-LOG_LIMIT) });
const bump = (s: RedisState, field: keyof RedisStats, by = 1): RedisStats => ({ ...s.stats, [field]: s.stats[field] + by });
const spend = (s: RedisState, ms: number, segment: SegmentKind) => {
  const req = s.req as NonNullable<RedisState["req"]>;   // only called while a request is in flight
  return { now: s.now + ms, req: { ...req, elapsed: req.elapsed + ms, segments: [...req.segments, { node: segment, ms }] } };
};

const userId = (key: string) => key.split(":")[1] ?? key;
const recordFor = (s: RedisState, key: string) => s.db[key] as UserRecord;   // demo keys always exist

const packet = (from: RedisNodeId, to: RedisNodeId, label: string, kind: PacketKind = "request"): Packet<RedisNodeId> => ({ from, to, label, kind });

// Client to application, through Nginx when the topology has it.
const inbound = (rec: Recorder, label: string) => {
  const s = rec.state;
  if (s.edge) {
    rec.emit("edge.received", (st) => spend(st, st.latency.client, "network"), {
      at: "edge", packets: [packet("client", "edge", label)],
    });
    rec.emit("edge.forwarded", (st) => spend(st, st.latency.edge, "network"), {
      at: "app", packets: [packet("edge", "app", label)],
    });
  } else {
    rec.emit("request.received", (st) => spend(st, st.latency.client, "network"), {
      at: "app", packets: [packet("client", "app", label)],
    });
  }
};

const outbound = (rec: Recorder, label: string, kind: PacketKind) => {
  const s = rec.state;
  if (s.edge) {
    rec.emit("edge.response", (st) => spend(st, st.latency.edge, "network"), {
      at: "edge", packets: [packet("app", "edge", label, kind)],
    });
    rec.emit("response.sent", (st) => spend(st, st.latency.client, "network"), {
      at: "client", packets: [packet("edge", "client", label, kind)],
    });
  } else {
    rec.emit("response.sent", (st) => spend(st, st.latency.client, "network"), {
      at: "client", packets: [packet("app", "client", label, kind)],
    });
  }
};

const finish = (rec: Recorder, status: RequestStatus, value: UserRecord | null) => {
  rec.emit("request.done", (s) => {
    const req = { ...(s.req as NonNullable<RedisState["req"]>), status, value };
    return {
      req: null,
      history: [...s.history, req].slice(-HISTORY_LIMIT),
    };
  }, { at: "client", dur: 240, status });
};

// The cache-aside read path. The branch taken depends only on state.
export const get = (state: RedisState, key: string): RedisFrame[] => {
  const rec = recorder(state);
  rec.emit("request.start", (s) => ({
    req: { id: s.stats.requests + 1, key, elapsed: 0, segments: [], status: null, reason: null },
    stats: bump(s, "requests"),
  }), { at: "client", dur: 280, key });

  inbound(rec, `GET /users/${userId(key)}`);

  if (!rec.state.redisUp) {
    rec.emit("cache.lookup", null, { at: "redis", key, packets: [packet("app", "redis", `GET ${key}`, "command")] });
    rec.emit("cache.error", (s) => ({
      ...spend(s, s.latency.redisTimeout, "timeout"),
      ...addLog(s, `GET ${key}`, "(connection timed out)"),
    }), { at: "app", key, dur: 900, packets: [packet("redis", "app", "timeout", "error")] });

    if (rec.state.policy === "strict") {
      rec.emit("request.rejected", (s) => ({ stats: bump(s, "failed") }), { at: "app", key });
      outbound(rec, "503", "error");
      finish(rec, "failed", null);
      return rec.frames;
    }
    readThrough(rec, key, { write: false });
    return rec.frames;
  }

  rec.emit("cache.lookup", (s) => spend(s, s.latency.redis, "redis"), {
    at: "redis", key, packets: [packet("app", "redis", `GET ${key}`, "command")],
  });

  const entry = rec.state.cache[key];
  if (entry && isLive(entry, rec.state.now)) {
    const value = entry.value;
    const stale = value.version < recordFor(rec.state, key).version;
    rec.emit("cache.hit", (s) => ({
      ...spend(s, s.latency.redis, "redis"),
      ...addLog(s, `GET ${key}`, show(value)),
      stats: bump(s, "hits"),
      req: { ...spend(s, s.latency.redis, "redis").req, reason: "hit" },
    }), { at: "app", key, packets: [packet("redis", "app", show(value), "value")] });
    if (stale) rec.emit("response.stale", (s) => ({ stats: bump(s, "stale") }), { at: "app", key, dur: 800, value });
    outbound(rec, "200 OK", stale ? "stale" : "value");
    finish(rec, stale ? "stale" : "hit", value);
    return rec.frames;
  }

  // Absent, or present but past its expiry: to a caller the two are the same.
  const reason = entry ? "expired" : "missing";
  rec.emit(reason === "expired" ? "cache.expired" : "cache.miss", (s) => {
    const cache = { ...s.cache };
    delete cache[key];   // Redis reclaims an expired key when it is next touched
    return {
      ...spend(s, s.latency.redis, "redis"),
      ...addLog(s, `GET ${key}`, "(nil)"),
      cache,
      stats: bump(s, "misses"),
      req: { ...spend(s, s.latency.redis, "redis").req, reason },
    };
  }, { at: "app", key, packets: [packet("redis", "app", "(nil)", "miss")] });

  readThrough(rec, key, { write: true });
  return rec.frames;
};

const readThrough = (rec: Recorder, key: string, { write }: { write: boolean }) => {
  const id = userId(key);
  const sql = `SELECT … WHERE id = ${id}`;
  rec.emit("db.query", (s) => ({
    ...spend(s, s.latency.db, "postgres"),
    stats: bump(s, "dbQueries"),
  }), { at: "db", key, packets: [packet("app", "db", sql, "command")], dur: 900 });

  const value = recordFor(rec.state, key);
  rec.emit("db.result", (s) => spend(s, s.latency.db, "postgres"), {
    at: "app", key, value, packets: [packet("db", "app", show(value), "value")], dur: 900,
  });

  if (write) {
    rec.emit("cache.write", (s) => {
      const after = spend(s, s.latency.redis * 2, "redis");
      return {
        ...after,
        ...addLog(s, `SET ${key} ${show(value)} EX ${s.ttl}`, "OK"),
        cache: { ...s.cache, [key]: { value, storedAt: after.now, expiresAt: after.now + s.ttl * 1000 } },
      };
    }, { at: "redis", key, packets: [packet("app", "redis", `SET ${key} EX ${rec.state.ttl}`, "command")] });
  }
  outbound(rec, "200 OK", "value");
  finish(rec, write ? "miss" : "bypass", value);
};

// Move the simulated clock. Keys past their expiry stop being readable at
// once; the entry stays visible, greyed, until something touches it.
export const advanceClock = (state: RedisState, seconds: number): RedisFrame[] => {
  const rec = recorder(state);
  rec.emit("clock.advanced", (s) => ({ now: s.now + seconds * 1000 }), { dur: 500, seconds });
  return rec.frames;
};

// Change the source of truth, as an admin screen or another service might.
export const updateRecord = (state: RedisState, key: string, patch: Partial<UserRecord>): RedisFrame[] => {
  const rec = recorder(state);
  const current = recordFor(state, key);
  const next = { ...current, ...patch, version: current.version + 1 };
  rec.emit("db.update", (s) => ({
    db: { ...s.db, [key]: next },
    stats: bump(s, "dbQueries"),
  }), { at: "db", key, value: next, packets: [packet("app", "db", `UPDATE … plan='${next.plan}'`, "command")], dur: 800 });

  if (rec.state.invalidation === "none") {
    rec.emit("invalidate.skipped", null, { at: "app", key, dur: 900 });
    return rec.frames;
  }
  if (!rec.state.redisUp) {
    rec.emit("invalidate.failed", (s) => addLog(s, `DEL ${key}`, "(connection timed out)"), {
      at: "app", key, dur: 900, packets: [packet("app", "redis", `DEL ${key}`, "error")],
    });
    return rec.frames;
  }
  const existed = !!rec.state.cache[key];
  rec.emit("invalidate.deleted", (s) => {
    const cache = { ...s.cache };
    delete cache[key];
    return { cache, ...addLog(s, `DEL ${key}`, `(integer) ${existed ? 1 : 0}`) };
  }, { at: "redis", key, packets: [packet("app", "redis", `DEL ${key}`, "command")] });
  return rec.frames;
};

// Taking Redis down drops the connection. Bringing it back models a restart
// with no persistence, so the keyspace returns empty.
export const setRedisUp = (state: RedisState, up: boolean): RedisFrame[] => {
  const rec = recorder(state);
  rec.emit(up ? "redis.restored" : "redis.down", (s) => ({ redisUp: up, cache: up ? {} : s.cache }), { at: "redis", dur: 500 });
  return rec.frames;
};

export const flush = (state: RedisState): RedisFrame[] => {
  const rec = recorder(state);
  rec.emit("cache.flushed", (s) => ({ cache: {}, ...addLog(s, "FLUSHALL", "OK") }), { at: "redis", dur: 500 });
  return rec.frames;
};

export const configure = (state: RedisState, patch: RedisConfig): RedisFrame[] => {
  const rec = recorder(state);
  rec.emit("config.changed", () => patch, { dur: 1, patch });
  return rec.frames;
};

// A popular key with no live entry, hit by `count` requests at the same
// moment. Without coordination every one misses and goes to Postgres. With
// single-flight, one request rebuilds the entry and the others wait for it.
export const stampede = (state: RedisState, key: string, count: number, singleFlight: boolean): RedisFrame[] | null => {
  const s = state;
  const expired = !isLive(s.cache[key], s.now);
  if (!s.redisUp || !expired) return null;
  const queries = singleFlight ? 1 : count;
  const value = recordFor(s, key);
  const each = (from: RedisNodeId, to: RedisNodeId, label: string, kind?: PacketKind) => Array.from({ length: count }, () => packet(from, to, label, kind));
  const rec = recorder(s);
  rec.emit("stampede.arrive", (st) => ({ stats: bump(st, "requests", count) }), {
    at: "app", count, packets: each("client", "app", "GET"),
  });
  rec.emit("stampede.lookup", (st) => ({
    stats: bump(st, "misses", count),
    log: [...st.log, { cmd: `GET ${key}  ×${count}`, reply: "(nil)" }].slice(-LOG_LIMIT),
  }), { at: "redis", count, packets: each("app", "redis", "GET", "command") });
  rec.emit("stampede.query", (st) => ({ stats: bump(st, "dbQueries", queries) }), {
    at: "db", count: queries, dur: 1000, singleFlight,
    packets: Array.from({ length: queries }, () => packet("app", "db", "SELECT", "command")),
  });
  rec.emit("stampede.write", (st) => {
    const expiresAt = st.now + st.ttl * 1000;
    return { cache: { ...st.cache, [key]: { value, storedAt: st.now, expiresAt } } };
  }, { at: "redis", count, packets: [packet("app", "redis", `SET ${key}`, "command")] });
  rec.emit("stampede.done", null, { at: "client", count, packets: each("app", "client", "200", "value") });
  return rec.frames;
};

export const lastState = (frames: RedisFrame[], fallback: RedisState) => frames[frames.length - 1]?.state ?? fallback;

// Run several actions in a row; used by scenarios, the challenge and tests.
export const run = (state: RedisState, ...actions: RedisAction[]) => {
  let s = state;
  const frames: RedisFrame[] = [];
  for (const action of actions) {
    const out = action(s) || [];
    frames.push(...out);
    s = lastState(out, s);
  }
  return { state: s, frames };
};
