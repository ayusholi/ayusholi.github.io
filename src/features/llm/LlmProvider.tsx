"use client";

import { createBench } from "@/lib/simulation/createBench";
import { baseline, buildScenario, readyFrame, SCENARIOS } from "./llm-scenarios";

export const { Provider: LlmProvider, useBench: useLlm } = createBench({
  name: "Llm",
  initial: () => baseline(),
  ready: readyFrame,
  scenarios: SCENARIOS,
  first: "next",
  build: buildScenario,
  resetLesson: "An empty context. Pick a prompt, then generate one token at a time or run to the end.",
});
