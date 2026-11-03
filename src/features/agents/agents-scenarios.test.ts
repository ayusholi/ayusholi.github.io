import { test } from "vitest";
import assert from "node:assert/strict";
import { buildScenario, SCENARIOS, type ScenarioId } from "./agents-scenarios";

const end = (id: ScenarioId) => {
  const { state, frames } = buildScenario(id);
  return frames[frames.length - 1]?.state ?? state;
};

test("each scenario shows what its lesson claims", () => {
  assert.equal(end("tool").stats.toolCalls, 1);
  assert.equal(end("chain").stats.recipients, 6);
  assert.equal(end("approval").pending?.tool, "email");
  assert.equal(end("injection").stats.recipients, 214);
  assert.equal(end("runaway").done, "limit");
});

test("running a scenario twice gives the same frames", () => {
  for (const id of Object.keys(SCENARIOS) as ScenarioId[]) assert.deepEqual(buildScenario(id), buildScenario(id));
});
