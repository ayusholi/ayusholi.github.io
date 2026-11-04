"use client";

import { Challenge } from "@/components/ui/Challenge";
import { reducedMotion, useTimelineFrame } from "@/lib/simulation/useTimeline";
import { useDatabases } from "./DatabasesProvider";
import { explain } from "./databases-content";
import { createState, runAll } from "./databases-engine";
import { ACTIONS } from "./databases-scenarios";

const watch = (run: () => void) => () => {
  run();
  document.getElementById("bench")?.scrollIntoView({ behavior: reducedMotion() ? "auto" : "smooth" });
};

const n = (v: number) => v.toLocaleString("en");

// What PostgreSQL would report for the latest statement.
export const DatabasesExplain = () => {
  const { timeline } = useDatabases();
  const { state } = useTimelineFrame(timeline);
  const [head, ...rest] = explain(state);
  return (
    <pre className="cli" id="explain" tabIndex={0} aria-label="EXPLAIN output for the latest statement">
      <span className="dim">{`=# ${head}`}</span>{rest.length ? `\n${rest.join("\n")}` : ""}
    </pre>
  );
};

// The tail of the write-ahead log, and which records have reached disk.
export const DatabasesWal = () => {
  const { timeline } = useDatabases();
  const { state } = useTimelineFrame(timeline);
  const lines = state.wal.length ? [...state.wal].reverse().map((w) => `LSN ${w.lsn}  INSERT orders  ${w.flushed ? "on disk" : "in memory only"}`) : ["(empty)"];
  return (
    <pre className="cli" id="wal" tabIndex={0} aria-label="The write-ahead log, newest first">
      <span className="dim">$ tail pg_wal</span>{`\n${lines.join("\n")}`}
    </pre>
  );
};

// Answers are computed by running the question through the engine.
export const DatabasesChallenges = () => {
  const { runScenario } = useDatabases();
  return (
    <>
      <Challenge
        id="challenge"
        question="orders has an index on customer_id. A query asks for WHERE lower(email) = 'priya@example.com'. How many rows does the database examine?"
        options={["About eight: the index finds them.", "All of them: the index doesn't cover this condition.", "None: the index answers it without the table."]}
        answer={1}
        verdict={() => {
          const s = runAll(createState({ index: true }), ACTIONS.run("email")).state.runs[0];
          const i = runAll(createState({ index: true }), ACTIONS.run("find")).state.runs[0];
          return `The simulation examines ${n(s?.examined ?? 0)} rows to return ${s?.returned}, in ${s?.ms} ms. The same rows found by customer_id take ${i?.examined} rows and ${i?.ms} ms. An index serves the expression it was built on: here that would be CREATE INDEX ON orders (lower(email)).`;
        }}
        watch={{ label: "Watch it happen ↑", run: watch(() => runScenario("unused")) }}
      />
      <Challenge
        id="challenge-2"
        className="mt-11"
        question="An INSERT returns COMMIT, and a moment later the server loses power. The changed page was still in memory. Is the order there after restart?"
        options={["No: it never reached the table file.", "Yes: the write-ahead log on disk is replayed.", "Only if a checkpoint had run first."]}
        answer={1}
        verdict={() => {
          const sync = runAll(createState({ commit: "sync" }), ACTIONS.run("insert"), ACTIONS.crash()).state;
          const fast = runAll(createState({ commit: "async" }), ACTIONS.run("insert"), ACTIONS.crash()).state;
          return `With synchronous_commit on, COMMIT waited for the log, so recovery redoes the insert: ${sync.stats.lost} rows lost. Turn it off and COMMIT returns before the log is flushed: crash in that gap and ${fast.stats.lost} committed order disappears. That's a trade some systems accept for speed, but it should be a decision.`;
        }}
        watch={{ label: "Watch it happen ↑", run: watch(() => runScenario("crash")) }}
      />
    </>
  );
};
