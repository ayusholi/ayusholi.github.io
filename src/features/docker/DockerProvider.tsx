"use client";

import { createBench } from "@/lib/simulation/createBench";
import { createState } from "./docker-engine";
import { buildScenario, readyFrame, SCENARIOS } from "./docker-scenarios";

export const { Provider: DockerProvider, useBench: useDocker } = createBench({
  name: "Docker",
  initial: () => createState(),
  ready: readyFrame,
  scenarios: SCENARIOS,
  first: "cold",
  build: buildScenario,
  resetLesson: "A clean machine: no images, no containers. Run something, or pick a scenario above.",
});
