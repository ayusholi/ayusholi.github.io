"use client";

import { createBench } from "@/lib/simulation/createBench";
import { baseline, buildScenario, readyFrame, SCENARIOS } from "./rag-scenarios";

export const { Provider: RagProvider, useBench: useRag } = createBench({
  name: "Rag",
  initial: () => baseline(),
  ready: readyFrame,
  scenarios: SCENARIOS,
  first: "grounded",
  build: buildScenario,
  resetLesson: "Three documents, freshly indexed. Ask a question, or change the policy and see who notices.",
});
