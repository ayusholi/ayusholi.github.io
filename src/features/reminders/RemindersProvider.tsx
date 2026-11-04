"use client";

import { createBench } from "@/lib/simulation/createBench";
import { baseline, buildScenario, readyFrame, SCENARIOS } from "./reminders-scenarios";

export const { Provider: RemindersProvider, useBench: useReminders } = createBench({
  name: "Reminders",
  initial: () => baseline(),
  ready: readyFrame,
  scenarios: SCENARIOS,
  first: "one",
  build: buildScenario,
  resetLesson: "It's Monday evening in Kathmandu and the bot has no reminders. Send it a message, or pick a scenario above.",
});
