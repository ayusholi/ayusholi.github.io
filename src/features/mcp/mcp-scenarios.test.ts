import { test } from "vitest";
import assert from "node:assert/strict";
import { buildScenario, SCENARIOS, type ScenarioId } from "./mcp-scenarios";

const end = (id: ScenarioId) => {
  const { state, frames } = buildScenario(id);
  return frames[frames.length - 1]?.state ?? state;
};

test("each scenario shows what its lesson claims", () => {
  assert.equal(end("handshake").stats.tools, 2);
  assert.equal(end("call").stats.toolCalls, 1);
  assert.equal(end("two").stats.servers, 2);
  assert.equal(end("error").stats.toolErrors, 1);
  assert.ok(end("approval").pending);
});

test("running a scenario twice gives the same frames", () => {
  for (const id of Object.keys(SCENARIOS) as ScenarioId[]) assert.deepEqual(buildScenario(id), buildScenario(id));
});
