// The database's words, kept apart from its logic. `describe` narrates a frame from
// the state that frame holds, so the caption can't disagree with the simulation.
import { INDEX_DEPTH, pages, SQL } from "./databases-engine";
import type { DbEventType, DbFrame, DbNodeId, DbState } from "./databases-types";

export const ROLES: Record<DbNodeId, { name: string; sub: string; role: string }> = {
  client: { name: "Your app", sub: "Sends SQL", role: "Sends one statement as text over a connection and waits. It says what it wants, never how to find it: that's the database's decision." },
  planner: { name: "Parser & planner", sub: "SQL → plan", role: "Parses the SQL into a tree, checks the names against the catalog, then estimates the cost of every way to run it, using statistics about the table, and picks the cheapest." },
  executor: { name: "Executor", sub: "Runs the plan", role: "Carries out the plan node by node: scan, filter, fetch. It never touches the disk directly; it asks the buffer pool for pages." },
  buffer: { name: "Buffer pool", sub: "Pages in memory", role: "Shared memory holding 8 KB pages of tables and indexes (shared_buffers). A page found here is a hit and costs microseconds. Changed pages sit here dirty until a checkpoint writes them out." },
  disk: { name: "Table files", sub: "8 KB pages", role: "The table and its indexes on disk, as files of 8 KB pages. Reading here is what makes queries slow, so everything above it exists to read less." },
  wal: { name: "WAL", sub: "Write-ahead log", role: "An append-only log of every change, written before the change counts. Appending is fast and sequential, and after a crash it's what lets the database redo the changes whose pages never reached disk." },
};

type Note = [title: string, text: string];

const run = (f: DbFrame) => f.state.runs[f.state.runs.length - 1];
const n = (v: number) => v.toLocaleString("en");

const NOTES: Record<DbEventType, (f: DbFrame) => Note> = {
  ready: (f) => ["Ready", `An orders table with ${n(f.state.rows)} rows${f.state.index ? " and an index on customer_id" : ", no indexes"}. Memory is empty. Run a query.`],
  parsed: (f) => [`Query ${run(f)?.n}: parsed`, `“${SQL[run(f)?.query ?? "find"]}” becomes a tree. orders, customer_id and email are checked against the catalog.`],
  planned: (f) => {
    const r = run(f);
    if (r?.plan === "Insert") return ["Planned: Insert", f.state.index ? "One row into the table, and one entry into the index." : "One row into the table. No indexes to update."];
    if (r?.plan === "Index Scan") return ["Planned: Index Scan", `The estimate says about ${f.state.mine} of ${n(f.state.rows)} rows match. Walking the index costs a handful of pages; scanning costs ${n(pages(f.state))}.`];
    return ["Planned: Seq Scan", r?.query === "email" && f.state.index ? "The only index is on customer_id, and this asks about lower(email). Nothing can narrow the search, so every row has to be checked." : "There's no index on customer_id, so the only plan is to read every page and check every row."];
  },
  "buffer.checked": (f) => {
    const r = run(f);
    return [`${n((r?.read ?? 0) + (r?.hit ?? 0))} pages needed`, r?.plan === "Index Scan" ? `${INDEX_DEPTH} index pages, root to leaf, then one table page per matching row. ${r.hit} already in memory.` : `${n(r?.hit ?? 0)} of them are already in the buffer pool.`];
  },
  "disk.read": (f) => [`Read ${n(run(f)?.read ?? 0)} pages from disk`, run(f)?.plan === "Seq Scan" ? "Over a hundred megabytes, read in order. This is most of the query's time." : "A few small reads, in whatever order the index points to."],
  "rows.returned": (f) => {
    const r = run(f);
    return [`${r?.returned} rows in ${r?.ms} ms`, `Rows examined: ${n(r?.examined ?? 0)}. ${r?.read ? `Pages read from disk: ${n(r.read)}.` : "Every page came from memory."}`];
  },
  "row.written": () => ["The row goes into a page in memory", "Not to disk yet. The page is now dirty: different from the copy in the table file."],
  "index.updated": () => ["The index is updated too", "Every index is another write on every insert. That's the price of fast reads."],
  "wal.appended": (f) => [`Logged at LSN ${f.state.lsn}`, "The change is appended to the write-ahead log, still in a memory buffer."],
  "wal.flushed": () => ["fsync: the log reaches disk", "synchronous_commit is on, so COMMIT waits until the disk confirms the log record is stored. This wait is the cost of a commit."],
  committed: (f) => {
    const flushed = f.state.wal[f.state.wal.length - 1]?.flushed;
    return [`COMMIT in ${run(f)?.ms} ms`, flushed ? "The client is told it's saved, and it is: the log is on disk, even though the table file isn't updated yet." : "The client is told it's saved, but the log record is still in memory. The WAL writer will flush it within a fraction of a second."];
  },
  crashed: (f) => ["Crash", `Power is cut. The buffer pool is gone, with ${f.state.dirty ? "its dirty pages" : "every cached page"}. Only what's on disk survives: the table files and the log.`],
  recovered: (f) => (f.state.stats.lost
    ? ["Recovered, minus one order", `Replaying the log can only redo what reached it. ${f.state.stats.lost} committed row was lost: the table has ${n(f.state.rows)} rows again.`]
    : ["Recovered", `The database replays the log from the last checkpoint and redoes each change. Nothing committed is missing: ${n(f.state.rows)} rows, ${f.state.mine} for customer 42.`]),
  "index.built": () => ["CREATE INDEX", "The table is read once and every customer_id sorted into a B-tree. From now on, the planner has a choice."],
  "index.dropped": () => ["DROP INDEX", "The planner is back to one option for customer_id: read everything."],
  "config.changed": ({ patch = {} }) => [patch.commit === "async" ? "synchronous_commit = off" : "synchronous_commit = on", patch.commit === "async" ? "COMMIT returns as soon as the log record is written to memory." : "COMMIT waits for the log to be flushed to disk."],
};

export const describe = (frame: DbFrame): Note => NOTES[frame.type](frame);

// EXPLAIN (ANALYZE, BUFFERS) for the latest statement, in PostgreSQL's format.
export const explain = (s: DbState): string[] => {
  const r = s.runs[s.runs.length - 1];
  if (!r) return ["(no query yet)"];
  const head = `EXPLAIN (ANALYZE, BUFFERS) ${SQL[r.query]}`;
  if (r.plan === "Insert") return [head, "Insert on orders  (actual rows=0)", "  ->  Result  (actual rows=1)", `Execution Time: ${r.ms} ms`];
  const buffers = `  Buffers: shared hit=${r.hit}${r.read ? ` read=${r.read}` : ""}`;
  if (r.plan === "Index Scan") {
    return [head, `Index Scan using orders_customer_id_idx on orders  (actual rows=${r.returned})`, "  Index Cond: (customer_id = 42)", buffers, `Execution Time: ${r.ms} ms`];
  }
  return [
    head, `Seq Scan on orders  (actual rows=${r.returned})`,
    r.query === "email" ? "  Filter: (lower(email) = 'priya@example.com')" : "  Filter: (customer_id = 42)",
    `  Rows Removed by Filter: ${r.examined - r.returned}`, buffers, `Execution Time: ${r.ms} ms`,
  ];
};
