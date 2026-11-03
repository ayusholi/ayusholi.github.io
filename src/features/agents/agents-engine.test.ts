import { test } from "vitest";
import assert from "node:assert/strict";
import { createState, runAll, tokensOf } from "./agents-engine";
import { ACTIONS } from "./agents-scenarios";

test("a tool result goes into the transcript and the model is called again", () => {
  const { state } = runAll(createState(), ACTIONS.assign("weather"));
  assert.equal(state.stats.toolCalls, 1);
  assert.equal(state.stats.modelCalls, 2);
  assert.deepEqual(state.transcript.map((m) => m.role), ["user", "assistant", "tool", "assistant"]);
  assert.equal(state.done, "answered");
});

test("the model chains steps from what each result says", () => {
  const { state } = runAll(createState(), ACTIONS.assign("hike"));
  assert.equal(state.outbox.length, 1);
  assert.equal(state.stats.recipients, 6);
  assert.equal(state.stats.modelCalls, 3);
});

test("side effects wait for approval, and a refusal is a result the model reads", () => {
  const held = runAll(createState({ approval: "ask" }), ACTIONS.assign("hike")).state;
  assert.equal(held.pending?.tool, "email");
  assert.equal(held.outbox.length, 0);
  assert.equal(held.done, null);
  assert.equal(runAll(held, ACTIONS.approve()).state.outbox.length, 1);
  const denied = runAll(held, ACTIONS.deny()).state;
  assert.equal(denied.outbox.length, 0);
  assert.equal(denied.done, "answered");
  assert.equal(ACTIONS.approve()(createState()), null, "nothing to approve");
});

test("injected text in a tool result can trigger a side effect, unless it's gated", () => {
  assert.equal(runAll(createState(), ACTIONS.assign("research")).state.stats.recipients, 214);
  const gated = runAll(createState({ approval: "ask" }), ACTIONS.assign("research"), ACTIONS.deny()).state;
  assert.equal(gated.stats.recipients, 0);
  assert.equal(gated.done, "answered");
});

test("a failing tool is retried, then reported honestly", () => {
  const { state } = runAll(createState({ weatherDown: true }), ACTIONS.assign("weather"));
  assert.equal(state.stats.toolErrors, 2);
  assert.equal(state.done, "answered");
});

test("the step budget stops a loop that never finishes", () => {
  const { state } = runAll(createState({ limit: "4" }), ACTIONS.assign("loop"));
  assert.equal(state.done, "limit");
  assert.equal(state.stats.toolCalls, 4);
});

test("every model call resends the transcript, so cost grows faster than steps", () => {
  const short = runAll(createState({ limit: "4" }), ACTIONS.assign("loop")).state;
  const long = runAll(createState({ limit: "10" }), ACTIONS.assign("loop")).state;
  assert.ok(long.stats.tokens / short.stats.tokens > long.stats.toolCalls / short.stats.toolCalls);
  assert.ok(tokensOf(long.transcript) > tokensOf(short.transcript));
});
