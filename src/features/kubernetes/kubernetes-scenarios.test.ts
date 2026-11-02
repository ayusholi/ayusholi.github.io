import { test } from "vitest";
import assert from "node:assert/strict";
import { converge, live, pending, reportedReady, serving } from "./kubernetes-engine";
import { buildScenario, SCENARIOS, type ScenarioId } from "./kubernetes-scenarios";

const settle = (id: ScenarioId) => {
  const { state, frames } = buildScenario(id);
  return converge(frames[frames.length - 1]?.state ?? state);
};

test("each scenario shows what its lesson claims", () => {
  assert.equal(settle("heal").stats.created, 4);
  const node = buildScenario("node").frames[0]!.state;
  assert.ok(reportedReady(node) > serving(node));
  assert.equal(serving(settle("node")), 3);
  assert.equal(pending(settle("scale")), 1);
  assert.ok(live(settle("rollout")).every((p) => p.version === "v2"));
  assert.equal(live(settle("broken")).filter((p) => p.version === "v1").length, 3);
});

test("running a scenario twice gives the same frames", () => {
  for (const id of Object.keys(SCENARIOS) as ScenarioId[]) assert.deepEqual(buildScenario(id), buildScenario(id));
});
