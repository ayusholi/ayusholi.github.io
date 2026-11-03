"use client";

import { createBench } from "@/lib/simulation/createBench";
import { baseline, buildScenario, readyFrame, SCENARIOS } from "./agents-scenarios";

export const { Provider: AgentsProvider, useBench: useAgents } = createBench({
  name: "Agents",
  initial: () => baseline(),
  ready: readyFrame,
  scenarios: SCENARIOS,
  first: "tool",
  build: buildScenario,
  resetLesson: "An idle agent with three tools. Give it a task, or pick a scenario above.",
});
