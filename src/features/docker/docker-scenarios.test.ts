import { test } from "vitest";
import assert from "node:assert/strict";
import { filesSeenBy } from "./docker-engine";
import { buildScenario, SCENARIOS, type ScenarioId } from "./docker-scenarios";

const end = (id: ScenarioId) => {
  const { state, frames } = buildScenario(id);
  return frames[frames.length - 1]?.state ?? state;
};

test("each scenario shows what its lesson claims", () => {
  assert.equal(end("cold").stats.downloadedMb, 117);
  assert.equal(end("warm").stats.downloadedMb, 117);
  assert.ok(buildScenario("warm").frames.every((f) => f.type !== "layer.pulled"));
  assert.equal(end("update").stats.downloadedMb, 119);
  assert.equal(end("limit").containers[0]?.exitCode, 137);
  const lost = end("ephemeral");
  assert.deepEqual(filesSeenBy(lost, lost.containers[0]!), []);
});

test("running a scenario twice gives the same frames", () => {
  for (const id of Object.keys(SCENARIOS) as ScenarioId[]) assert.deepEqual(buildScenario(id), buildScenario(id));
});
