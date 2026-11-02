import { test } from "vitest";
import assert from "node:assert/strict";
import { errorRate } from "./cicd-engine";
import { buildScenario, SCENARIOS, type ScenarioId } from "./cicd-scenarios";

const end = (id: ScenarioId) => {
  const { state, frames } = buildScenario(id);
  return frames[frames.length - 1]?.state ?? state;
};

test("each scenario shows what its lesson claims", () => {
  assert.equal(end("green").stats.deploys, 2);
  assert.equal(end("red").stats.failedRuns, 1);
  assert.equal(errorRate(end("escape")), 100);
  assert.equal(end("canary").stats.badResponses, 10);
  assert.notEqual(end("gate").waiting, null);
});

test("running a scenario twice gives the same frames", () => {
  for (const id of Object.keys(SCENARIOS) as ScenarioId[]) assert.deepEqual(buildScenario(id), buildScenario(id));
});
