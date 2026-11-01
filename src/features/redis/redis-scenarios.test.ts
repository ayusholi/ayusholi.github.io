import { test } from "vitest";
import assert from "node:assert/strict";
import { buildScenario, SCENARIOS, type ScenarioId } from "./redis-scenarios";
import { describe } from "./redis-content";

const end = (id: ScenarioId) => {
  const { state, frames } = buildScenario(id);
  return frames[frames.length - 1]?.state ?? state;
};

test("each scenario shows what its lesson claims", () => {
  assert.equal(end("miss").stats.misses, 1);
  assert.equal(end("hit").stats.hits, 1);
  assert.equal(end("expiry").history.at(-1)?.reason, "expired");
  assert.equal(end("invalidation").history.at(-1)?.status, "stale");
  assert.equal(end("failure").history.at(-1)?.status, "bypass");
});

test("running a scenario twice starts from the same state", () => {
  for (const id of Object.keys(SCENARIOS) as ScenarioId[]) assert.deepEqual(buildScenario(id), buildScenario(id));
});

test("every frame of every scenario has a caption", () => {
  for (const id of Object.keys(SCENARIOS) as ScenarioId[]) {
    for (const f of buildScenario(id).frames) assert.ok(describe(f)[0]);
  }
});
