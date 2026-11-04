"use client";

import { createBench } from "@/lib/simulation/createBench";
import { baseline, buildScenario, readyFrame, SCENARIOS } from "./databases-scenarios";

export const { Provider: DatabasesProvider, useBench: useDatabases } = createBench({
  name: "Databases",
  initial: () => baseline(),
  ready: readyFrame,
  scenarios: SCENARIOS,
  first: "scan",
  build: buildScenario,
  resetLesson: "A million orders, no indexes, and nothing in memory. Run a statement, or pick a scenario above.",
});
