import { test } from "vitest";
import assert from "node:assert/strict";
import { buildScenario, SCENARIOS, type ScenarioId } from "./reminders-scenarios";

const end = (id: ScenarioId) => {
  const { state, frames } = buildScenario(id);
  return frames[frames.length - 1]?.state ?? state;
};

test("each scenario shows what its lesson claims", () => {
  assert.equal(end("one").stats.delivered, 1);
  assert.notEqual(end("timezone").reminders[0]?.due, end("timezone").reminders[0]?.intended);
  assert.equal(end("unclear").stats.questions, 1);
  assert.equal(end("daytwo").stats.rejected, 1);
  assert.equal(end("template").stats.delivered, 2);
  assert.equal(end("template").stats.aiCalls, 1);
});

test("running a scenario twice gives the same frames", () => {
  for (const id of Object.keys(SCENARIOS) as ScenarioId[]) assert.deepEqual(buildScenario(id), buildScenario(id));
});
