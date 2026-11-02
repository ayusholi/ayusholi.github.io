"use client";

import { createBench } from "@/lib/simulation/createBench";
import { baseline, buildScenario, readyFrame, SCENARIOS } from "./cicd-scenarios";

export const { Provider: CicdProvider, useBench: useCicd } = createBench({
  name: "Cicd",
  initial: () => baseline(),
  ready: readyFrame,
  scenarios: SCENARIOS,
  first: "green",
  build: buildScenario,
  resetLesson: "Production runs one good release. Push a change, or pick a scenario above.",
});
