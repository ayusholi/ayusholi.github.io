// =========================================================
// A relational database executing queries, as a pure state model. No DOM, no timers.
//
// Models what PostgreSQL does with one statement: parse it, plan it
// (a sequential scan or an index scan), and execute the plan through
// the buffer pool, reading from disk only the pages that aren't in
// memory. Writes go to the write-ahead log first; a commit waits for
// the log to reach disk unless synchronous_commit is off. A crash
// empties memory, and recovery replays whatever the log kept.
// See databases-engine.test.ts.
//
// Simplified on purpose: one orders table, one optional index, one
// statement at a time, and round, illustrative costs per page.
// =========================================================

import type { Packet } from "@/lib/simulation/simulation-types";
import type { DbConfig, DbEventType, DbFrame, DbNodeId, DbState, PageGroup, Plan, QueryId, Run } from "./databases-types";

export const ROWS = 1_000_000;
export const ROWS_PER_PAGE = 80;          // 8 KB pages
export const INDEX_DEPTH = 3;             // root, branch, leaf
const MINE = 8;                           // customer 42's orders

export const SQL: Record<QueryId, string> = {
  find: "SELECT * FROM orders WHERE customer_id = 42;",
  email: "SELECT * FROM orders WHERE lower(email) = 'priya@example.com';",
  insert: "INSERT INTO orders (customer_id, email, total) VALUES (42, 'priya@example.com', 1800);",
};

// Milliseconds per 8 KB page. Sequential reads stream; index lookups jump around.
const SEQ_READ = 0.016, RANDOM_READ = 0.1, IN_MEMORY = 0.004;
export const FSYNC_MS = 2;

export const pages = (s: Pick<DbState, "rows">) => Math.ceil(s.rows / ROWS_PER_PAGE);

export const createState = (patch: DbConfig = {}): DbState => ({
  index: false,
  commit: "sync",
  cached: [],
  rows: ROWS,
  mine: MINE,
  dirty: 0,
  wal: [],
  runs: [],
  next: 1,
  lsn: 1000,
  stats: { queries: 0, examined: 0, diskReads: 0, cacheHits: 0, fsyncs: 0, lost: 0 },
  ...patch,
});

const packet = (from: DbNodeId, to: DbNodeId, label: string, kind: Packet["kind"] = "request"): Packet<DbNodeId> => ({ from, to, label, kind });

const chain = (state: DbState) => {
  let s = state;
  const frames: DbFrame[] = [];
  const step = (type: DbEventType, at: DbNodeId, packets: Packet<DbNodeId>[], patch: (st: DbState) => DbState = (st) => st, meta: Partial<DbFrame> = {}) => {
    s = patch(s);
    frames.push({ type, state: s, packets, at, dur: 700, ...meta });
  };
  return { step, get state() { return s; }, frames };
};

const add = (s: DbState, patch: Partial<DbState["stats"]>): DbState => ({
  ...s, stats: Object.fromEntries(Object.entries(s.stats).map(([k, v]) => [k, v + (patch[k as keyof DbState["stats"]] ?? 0)])) as DbState["stats"],
});
const cache = (s: DbState, ...groups: PageGroup[]): DbState => ({ ...s, cached: [...new Set([...s.cached, ...groups])] });
const current = (s: DbState, patch: Partial<Run>): DbState => ({ ...s, runs: s.runs.map((r, i) => (i === s.runs.length - 1 ? { ...r, ...patch } : r)) });
const round = (ms: number) => (ms >= 10 ? Math.round(ms) : Math.round(ms * 100) / 100);
// The background WAL writer: time has passed, so anything waiting reaches disk.
const settle = (s: DbState): DbState => ({ ...s, wal: s.wal.map((w) => ({ ...w, flushed: true })) });

// The planner's choice. An index on customer_id can't answer a question about lower(email).
export const planFor = (s: Pick<DbState, "index">, query: QueryId): Plan => (query === "insert" ? "Insert" : query === "find" && s.index ? "Index Scan" : "Seq Scan");

// Which pages a plan touches, and how many of them are already in memory.
const touch = (s: DbState, plan: Plan) => {
  if (plan === "Seq Scan") {
    const n = pages(s), hot = s.cached.includes("heap");
    return { read: hot ? 0 : n, hit: hot ? n : 0, ms: round((hot ? 0 : n * SEQ_READ) + n * IN_MEMORY), groups: ["heap", "heap42"] as PageGroup[] };
  }
  const idx = s.cached.includes("idx") ? 0 : INDEX_DEPTH;
  const heap = s.cached.includes("heap") || s.cached.includes("heap42") ? 0 : s.mine;
  const read = idx + heap, total = INDEX_DEPTH + s.mine;
  return { read, hit: total - read, ms: round(read * RANDOM_READ + total * IN_MEMORY), groups: ["idx", "heap42"] as PageGroup[] };
};

// ---------- Reading ----------
const select = (state: DbState, query: QueryId): DbFrame[] => {
  const c = chain(settle(state));
  const plan = planFor(state, query);
  const { read, hit, ms, groups } = touch(c.state, plan);
  const examined = plan === "Seq Scan" ? c.state.rows : c.state.mine;
  const run: Run = { n: state.next, query, plan, examined, returned: c.state.mine, read, hit, ms };

  c.step("parsed", "planner", [packet("client", "planner", "SELECT")], (s) => ({ ...add(s, { queries: 1 }), next: s.next + 1, runs: [...s.runs, { ...run, read: 0, hit: 0, examined: 0, returned: 0, ms: 0 }].slice(-8) }));
  c.step("planned", "executor", [packet("planner", "executor", plan, "command")]);
  c.step("buffer.checked", "buffer", [packet("executor", "buffer", `${(read + hit).toLocaleString("en")} pages`)], (s) => add(current(s, { hit }), { cacheHits: hit }));
  if (read) c.step("disk.read", "disk", [packet("buffer", "disk", `read ${read.toLocaleString("en")}`, "miss"), packet("disk", "buffer", "pages", "value")], (s) => add(cache(current(s, { read }), ...groups), { diskReads: read }), { dur: plan === "Seq Scan" ? 1100 : 700 });
  c.step("rows.returned", "client", [packet("executor", "client", `${run.returned} rows`, "value")], (s) => add(cache(current(s, { examined, returned: run.returned, ms }), ...groups), { examined }));
  return c.frames;
};

// ---------- Writing ----------
const insert = (state: DbState): DbFrame[] => {
  const c = chain(settle(state));
  const lsn = state.lsn + 1;
  const run: Run = { n: state.next, query: "insert", plan: "Insert", examined: 0, returned: 0, read: 0, hit: 0, ms: 0 };
  c.step("parsed", "planner", [packet("client", "planner", "INSERT")], (s) => ({ ...add(s, { queries: 1 }), next: s.next + 1, runs: [...s.runs, run].slice(-8) }));
  c.step("planned", "executor", [packet("planner", "executor", "Insert", "command")]);
  c.step("row.written", "buffer", [packet("executor", "buffer", "new row")], (s) => cache({ ...s, rows: s.rows + 1, mine: s.mine + 1, dirty: s.dirty + 1 }, "heap42"));
  if (c.state.index) c.step("index.updated", "buffer", [packet("executor", "buffer", "index entry")], (s) => cache({ ...s, dirty: s.dirty + 1 }, "idx"));
  c.step("wal.appended", "wal", [packet("executor", "wal", `LSN ${lsn}`, "command")], (s) => ({ ...s, lsn, wal: [...s.wal, { lsn, flushed: false }].slice(-6) }));
  const sync = c.state.commit === "sync";
  if (sync) c.step("wal.flushed", "wal", [packet("wal", "disk", "fsync", "command")], (s) => add(settle(s), { fsyncs: 1 }), { dur: 900 });
  c.step("committed", "client", [packet("executor", "client", "COMMIT", "value")], (s) => current(s, { returned: 1, ms: sync ? FSYNC_MS + 0.1 : 0.1 }));
  return c.frames;
};

export const execute = (state: DbState, query: QueryId): DbFrame[] => (query === "insert" ? insert(state) : select(state, query));

// ---------- Crash and recovery ----------
// Power is cut. Memory is gone: the cache, and every dirty page. The log on disk is not.
export const crash = (state: DbState): DbFrame[] => {
  const c = chain(state);
  const lost = state.wal.filter((w) => !w.flushed).length;
  c.step("crashed", "buffer", [], (s) => ({ ...s, cached: [], dirty: 0 }), { dur: 900 });
  c.step("recovered", "wal", [packet("wal", "buffer", `redo ${state.wal.filter((w) => w.flushed).length}`, "value")], (s) => add({
    ...s, rows: s.rows - lost, mine: s.mine - lost, wal: s.wal.filter((w) => w.flushed), cached: s.wal.length - lost > 0 ? ["heap42"] : [],
  }, { lost }), { dur: 1000 });
  return c.frames;
};

export const toggleIndex = (state: DbState): DbFrame[] => {
  if (state.index) return [{ type: "index.dropped", state: { ...state, index: false, cached: state.cached.filter((g) => g !== "idx") }, packets: [], at: "planner", dur: 600 }];
  const c = chain(state);
  const read = state.cached.includes("heap") ? 0 : pages(state);
  c.step("index.built", "disk", read ? [packet("buffer", "disk", `read ${read.toLocaleString("en")}`, "miss")] : [], (s) => add(cache({ ...s, index: true }, "heap", "heap42", "idx"), { diskReads: read }), { dur: 1100 });
  return c.frames;
};

export const configure = (state: DbState, patch: DbConfig): DbFrame[] => [{ type: "config.changed", state: { ...state, ...patch }, packets: [], dur: 1, patch }];

export const runAll = (state: DbState, ...actions: ((s: DbState) => DbFrame[] | null)[]) => {
  let s = state;
  const frames: DbFrame[] = [];
  for (const action of actions) {
    const out = action(s) ?? [];
    frames.push(...out);
    s = out[out.length - 1]?.state ?? s;
  }
  return { state: s, frames };
};
