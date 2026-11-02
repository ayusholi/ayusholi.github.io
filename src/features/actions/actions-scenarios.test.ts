import { test } from "vitest";
import assert from "node:assert/strict";
import { jobOf, latest, settle } from "./actions-engine";
import { buildScenario, SCENARIOS, type ScenarioId } from "./actions-scenarios";

const end = (id: ScenarioId) => {
  const { state, frames } = buildScenario(id);
  return settle(frames[frames.length - 1]?.state ?? state);
};

test("each scenario shows what its lesson claims", () => {
  assert.equal(jobOf(latest(end("push")), "deploy")?.status, "success");
  assert.equal(jobOf(latest(end("pr")), "deploy")?.status, "skipped");
  assert.equal(latest(end("fail"))?.status, "failure");
  assert.equal(end("concurrency").runs[0]?.status, "cancelled");
  assert.equal(end("cache").stats.misses, 2);
});

test("running a scenario twice gives the same frames", () => {
  for (const id of Object.keys(SCENARIOS) as ScenarioId[]) assert.deepEqual(buildScenario(id), buildScenario(id));
});
