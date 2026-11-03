import { test } from "vitest";
import assert from "node:assert/strict";
import { buildScenario, SCENARIOS, type ScenarioId } from "./automations-scenarios";

const end = (id: ScenarioId) => {
  const { state, frames } = buildScenario(id);
  return frames[frames.length - 1]?.state ?? state;
};

test("each scenario shows what its lesson claims", () => {
  assert.equal(end("one").stats.rows, 1);
  assert.equal(end("triage").stats.executions, 3);
  assert.equal(end("broken").stats.failed, 1);
  assert.equal(end("retry").stats.aiCalls, 2);
  assert.equal(end("duplicate").stats.replies, 2);
});

test("running a scenario twice gives the same frames", () => {
  for (const id of Object.keys(SCENARIOS) as ScenarioId[]) assert.deepEqual(buildScenario(id), buildScenario(id));
});
