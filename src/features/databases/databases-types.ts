import type { Packet, SimFrame } from "@/lib/simulation/simulation-types";

export type DbNodeId = "client" | "planner" | "executor" | "buffer" | "disk" | "wal";
export type QueryId = "find" | "email" | "insert";
export type Commit = "sync" | "async";
export type Plan = "Seq Scan" | "Index Scan" | "Insert";
// Groups of pages the buffer pool can hold: the whole table, the index's path to
// customer 42, and the table pages holding customer 42's rows.
export type PageGroup = "heap" | "idx" | "heap42";

export type Run = {
  n: number;
  query: QueryId;
  plan: Plan;
  examined: number;      // rows looked at
  returned: number;      // rows sent back
  read: number;          // pages read from disk
  hit: number;           // pages found in the buffer pool
  ms: number;
};

export type WalRecord = { lsn: number; flushed: boolean };

export type DbStats = { queries: number; examined: number; diskReads: number; cacheHits: number; fsyncs: number; lost: number };

export type DbState = {
  index: boolean;        // orders_customer_id_idx exists
  commit: Commit;        // synchronous_commit on or off
  cached: PageGroup[];
  rows: number;          // rows in the table
  mine: number;          // rows for customer 42
  dirty: number;         // changed pages not yet written to the table files
  wal: WalRecord[];
  runs: Run[];
  next: number;
  lsn: number;
  stats: DbStats;
};

export type DbEventType =
  | "ready" | "parsed" | "planned" | "buffer.checked" | "disk.read" | "rows.returned"
  | "row.written" | "index.updated" | "wal.appended" | "wal.flushed" | "committed"
  | "crashed" | "recovered" | "index.built" | "index.dropped" | "config.changed";

export type DbConfig = Partial<Pick<DbState, "index" | "commit">>;

export type DbFrame = SimFrame<DbState> & {
  type: DbEventType;
  packets: Packet<DbNodeId>[];
  at?: DbNodeId;
  patch?: DbConfig;
};

export type DbAction = (state: DbState) => DbFrame[] | null;
