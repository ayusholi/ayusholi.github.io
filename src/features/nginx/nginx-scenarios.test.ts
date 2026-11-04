import { test } from "vitest";
import assert from "node:assert/strict";
import { buildScenario, SCENARIOS, type ScenarioId } from "./nginx-scenarios";

const end = (id: ScenarioId) => {
  const { state, frames } = buildScenario(id);
  return frames[frames.length - 1]?.state ?? state;
};

test("each scenario shows what its lesson claims", () => {
  assert.equal(end("one").requests[0]?.upstream, "app1");
  assert.equal(end("spread").stats.appBusyMs, 120);
  assert.equal(end("c10k").stats.errors, 0);
  assert.equal(end("threads").stats.errors, 1);
  assert.equal(end("down").stats.retries, 1);
  assert.equal(end("down").stats.errors, 0);
});

test("running a scenario twice gives the same frames", () => {
  for (const id of Object.keys(SCENARIOS) as ScenarioId[]) assert.deepEqual(buildScenario(id), buildScenario(id));
});
