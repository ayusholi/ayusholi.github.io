import * as engine from "./databases-engine";
import type { DbAction, DbConfig, DbFrame, DbState, QueryId } from "./databases-types";

// The named moves a visitor or scenario can make.
export const ACTIONS = {
  run: (query: QueryId): DbAction => (s) => engine.execute(s, query),
  crash: (): DbAction => engine.crash,
  index: (): DbAction => engine.toggleIndex,
};

type Scenario = {
  label: string;
  title: string;
  lesson: string;
  options: DbConfig;
  play: DbAction[];
};

export const SCENARIOS = {
  scan: {
    label: "A", title: "Full scan",
    lesson: "No index, so the only way to find customer 42's orders is to read the whole table: 12,500 pages and a million rows, to return eight. Run it again and every page is already in memory.",
    options: {}, play: [ACTIONS.run("find"), ACTIONS.run("find")],
  },
  index: {
    label: "B", title: "Index",
    lesson: "Same query, with an index on customer_id. The planner walks three pages of a B-tree straight to customer 42, then fetches only the eight table pages that hold their rows.",
    options: { index: true }, play: [ACTIONS.run("find")],
  },
  unused: {
    label: "C", title: "Unused index",
    lesson: "The index is there, but this query asks about lower(email), which the index knows nothing about. The planner has no choice but a full scan. Indexes only help the questions they were built for.",
    options: { index: true }, play: [ACTIONS.run("email")],
  },
  crash: {
    label: "D", title: "Crash",
    lesson: "An insert is written to the log on disk before COMMIT returns. The power then goes and memory is wiped, including the changed page. On restart, the database replays the log and the order is back.",
    options: { commit: "sync" }, play: [ACTIONS.run("insert"), ACTIONS.crash()],
  },
  async: {
    label: "E", title: "Fast commit",
    lesson: "With synchronous_commit off, COMMIT returns before the log is flushed: twenty times faster. Crash in that gap and recovery has nothing to replay. The client was told “saved”, and the order is gone.",
    options: { commit: "async" }, play: [ACTIONS.run("insert"), ACTIONS.crash()],
  },
} satisfies Record<string, Scenario>;

export type ScenarioId = keyof typeof SCENARIOS;

export const readyFrame = (state: DbState): DbFrame => ({ type: "ready", state, packets: [], dur: 1 });

export const baseline = (options: DbConfig = {}) => engine.createState(options);

export const buildScenario = (id: ScenarioId) => {
  const sc: Scenario = SCENARIOS[id];
  const state = baseline(sc.options);
  return { state, frames: engine.runAll(state, ...sc.play).frames };
};
