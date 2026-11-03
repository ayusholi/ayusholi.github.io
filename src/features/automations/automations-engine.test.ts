import { test } from "vitest";
import assert from "node:assert/strict";
import { createState, parse, runAll } from "./automations-engine";
import { ACTIONS } from "./automations-scenarios";

test("an order is classified, logged and answered in one execution", () => {
  const { state } = runAll(createState(), ACTIONS.receive("order"));
  assert.deepEqual(state.rows, [{ orderId: "4471", from: "priya@example.com" }]);
  assert.equal(state.stats.replies, 1);
  assert.equal(state.item?.category, "order");
  assert.deepEqual(state.executions[0]?.path, ["trigger", "ai", "router", "sheet", "reply"]);
  assert.equal(state.executions[0]?.status, "success");
});

test("each category takes its own branch", () => {
  const { state } = runAll(createState(), ACTIONS.receive("order"), ACTIONS.receive("complaint"), ACTIONS.receive("spam"));
  assert.equal(state.stats.executions, 3);
  assert.equal(state.stats.rows, 1);
  assert.equal(state.stats.alerts, 1);
  assert.equal(state.stats.replies, 1, "complaints go to a person, spam goes nowhere");
});

test("invalid AI output fails the execution unless it's retried", () => {
  const stopped = runAll(createState({ onError: "stop" }), ACTIONS.receive("messy")).state;
  assert.equal(stopped.stats.failed, 1);
  assert.equal(stopped.stats.rows, 0);
  assert.equal(stopped.executions[0]?.status, "error");
  const retried = runAll(createState({ onError: "retry" }), ACTIONS.receive("messy")).state;
  assert.equal(retried.stats.failed, 0);
  assert.equal(retried.stats.aiCalls, 2);
  assert.equal(retried.rows[0]?.orderId, "5120");
});

test("a re-delivered email runs twice unless the workflow dedupes on message id", () => {
  const twice = runAll(createState(), ACTIONS.receive("order"), ACTIONS.redeliver()).state;
  assert.equal(twice.stats.rows, 2);
  assert.equal(twice.stats.replies, 2);
  const once = runAll(createState({ dedupe: "on" }), ACTIONS.receive("order"), ACTIONS.redeliver()).state;
  assert.equal(once.stats.rows, 1);
  assert.equal(once.executions[1]?.status, "skipped");
  const fresh = runAll(createState({ dedupe: "on" }), ACTIONS.receive("order"), ACTIONS.receive("order")).state;
  assert.equal(fresh.stats.rows, 2, "a new email with the same text is not a duplicate");
  assert.equal(ACTIONS.redeliver()(createState()), null);
});

test("the parser accepts only the schema", () => {
  assert.ok(parse('{"category":"order","orderId":"1","urgent":false}'));
  assert.equal(parse('{"category":"refund","urgent":false}'), null);
  assert.equal(parse("Sure! {category: order"), null);
});
