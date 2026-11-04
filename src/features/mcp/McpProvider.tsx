"use client";

import { createBench } from "@/lib/simulation/createBench";
import { baseline, buildScenario, readyFrame, SCENARIOS } from "./mcp-scenarios";

export const { Provider: McpProvider, useBench: useMcp } = createBench({
  name: "Mcp",
  initial: () => baseline(),
  ready: readyFrame,
  scenarios: SCENARIOS,
  first: "handshake",
  build: buildScenario,
  resetLesson: "A chat app with a model and no MCP servers. Connect one, ask a question, or pick a scenario above.",
});
