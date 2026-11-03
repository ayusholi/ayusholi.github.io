"use client";

import { createBench } from "@/lib/simulation/createBench";
import { baseline, buildScenario, readyFrame, SCENARIOS } from "./automations-scenarios";

export const { Provider: AutomationsProvider, useBench: useAutomations } = createBench({
  name: "Automations",
  initial: () => baseline(),
  ready: readyFrame,
  scenarios: SCENARIOS,
  first: "one",
  build: buildScenario,
  resetLesson: "An active workflow and an empty inbox. Send it an email, or pick a scenario above.",
});
