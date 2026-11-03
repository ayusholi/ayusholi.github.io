import { test } from "vitest";
import assert from "node:assert/strict";
import { buildScenario, SCENARIOS, type ScenarioId } from "./rag-scenarios";

const end = (id: ScenarioId) => {
  const { state, frames } = buildScenario(id);
  return frames[frames.length - 1]?.state ?? state;
};

test("each scenario shows what its lesson claims", () => {
  assert.equal(end("grounded").answer?.kind, "grounded");
  assert.equal(end("bare").answer?.kind, "unsupported");
  assert.equal(end("meaning").answer?.kind, "not-found");
  assert.equal(end("stale").stats.stale, 1);
  assert.equal(end("missing").answer?.kind, "not-found");
});

test("running a scenario twice gives the same frames", () => {
  for (const id of Object.keys(SCENARIOS) as ScenarioId[]) assert.deepEqual(buildScenario(id), buildScenario(id));
});
