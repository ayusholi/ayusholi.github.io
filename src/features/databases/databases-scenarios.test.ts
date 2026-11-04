import { test } from "vitest";
import assert from "node:assert/strict";
import { buildScenario, SCENARIOS, type ScenarioId } from "./databases-scenarios";

const end = (id: ScenarioId) => {
  const { state, frames } = buildScenario(id);
  return frames[frames.length - 1]?.state ?? state;
};

test("each scenario shows what its lesson claims", () => {
  assert.equal(end("scan").stats.diskReads, 12500);
  assert.equal(end("scan").stats.cacheHits, 12500);
  assert.equal(end("index").stats.examined, 8);
  assert.equal(end("unused").runs[0]?.plan, "Seq Scan");
  assert.equal(end("crash").stats.lost, 0);
  assert.equal(end("async").stats.lost, 1);
});

test("running a scenario twice gives the same frames", () => {
  for (const id of Object.keys(SCENARIOS) as ScenarioId[]) assert.deepEqual(buildScenario(id), buildScenario(id));
});
