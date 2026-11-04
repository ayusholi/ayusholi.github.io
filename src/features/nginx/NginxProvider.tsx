"use client";

import { createBench } from "@/lib/simulation/createBench";
import { baseline, buildScenario, readyFrame, SCENARIOS } from "./nginx-scenarios";

export const { Provider: NginxProvider, useBench: useNginx } = createBench({
  name: "Nginx",
  initial: () => baseline(),
  ready: readyFrame,
  scenarios: SCENARIOS,
  first: "one",
  build: buildScenario,
  resetLesson: "Nginx in front of three healthy app servers, nobody connected. Send it requests, or pick a scenario above.",
});
