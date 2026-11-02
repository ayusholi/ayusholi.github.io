import { test } from "vitest";
import assert from "node:assert/strict";
import { createState, errorRate, previousRelease, runAll } from "./cicd-engine";
import { ACTIONS, baseline } from "./cicd-scenarios";

test("a good commit is built once and the same artifact reaches every environment", () => {
  const { state } = runAll(createState(), ACTIONS.commit("good"));
  assert.equal(state.artifacts.length, 1);
  assert.equal(state.staging?.digest, state.artifacts[0]?.digest);
  assert.equal(state.prod?.digest, state.artifacts[0]?.digest);
  assert.ok(Object.values(state.runs[0]!.stages).every((st) => st === "passed"));
});

test("a failing test stops the line before anything is published", () => {
  const before = baseline();
  const { state } = runAll(before, ACTIONS.commit("breaks-test"));
  assert.equal(state.artifacts.length, before.artifacts.length);
  assert.equal(state.prod?.digest, before.prod?.digest);
  const run = state.runs[state.runs.length - 1]!;
  assert.equal(run.stages.test, "failed");
  assert.equal(run.stages.prod, "skipped");
});

test("a hidden bug passes every check and fails in production", () => {
  const { state } = runAll(baseline(), ACTIONS.commit("hidden-bug"));
  assert.equal(state.runs[state.runs.length - 1]?.stages.staging, "passed");
  assert.equal(errorRate(state), 100);
  assert.equal(state.stats.badResponses, 100);
});

test("rolling back redeploys an existing artifact", () => {
  const before = baseline();
  const { state } = runAll(before, ACTIONS.commit("hidden-bug"), ACTIONS.rollback());
  assert.equal(state.prod?.digest, before.prod?.digest);
  assert.equal(errorRate(state), 0);
  assert.equal(state.stats.runs, before.stats.runs + 1, "no new pipeline run");
});

test("a canary limits the damage and leaves production on the old release", () => {
  const before = baseline({ strategy: "canary" });
  const { state } = runAll(before, ACTIONS.commit("hidden-bug"));
  assert.equal(state.stats.badResponses, 10);
  assert.equal(state.prod?.digest, before.prod?.digest);
  assert.equal(state.runs[state.runs.length - 1]?.stages.prod, "failed");
  const good = runAll(before, ACTIONS.commit("good")).state;
  assert.equal(good.prod?.digest, good.artifacts[good.artifacts.length - 1]?.digest, "a healthy canary is promoted");
});

test("a manual gate holds the run until approved, and a newer commit supersedes it", () => {
  const held = runAll(baseline({ gate: "manual" }), ACTIONS.commit("good")).state;
  assert.notEqual(held.waiting, null);
  assert.equal(held.stats.deploys, 1);
  assert.equal(runAll(held, ACTIONS.approve()).state.stats.deploys, 2);
  const superseded = runAll(held, ACTIONS.commit("good")).state;
  assert.equal(superseded.runs.find((r) => r.id === held.waiting)?.stages.approve, "skipped");
});

test("there's nothing to roll back to on a first release", () => {
  assert.equal(previousRelease(runAll(createState(), ACTIONS.commit("good")).state), null);
  assert.equal(ACTIONS.rollback()(createState()), null);
});
