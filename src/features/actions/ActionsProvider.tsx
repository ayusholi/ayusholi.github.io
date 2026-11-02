"use client";

import { createBench } from "@/lib/simulation/createBench";
import { createState, tick } from "./actions-engine";
import { buildScenario, readyFrame, SCENARIOS } from "./actions-scenarios";

// Runners keep working between actions, so the timeline keeps ticking.
export const { Provider: ActionsProvider, useBench: useActions } = createBench({
  name: "Actions",
  initial: () => createState(),
  ready: readyFrame,
  scenarios: SCENARIOS,
  first: "push",
  build: buildScenario,
  generate: tick,
  resetLesson: "No runs yet, and the dependency cache is warm. Push something, or pick a scenario above.",
});
