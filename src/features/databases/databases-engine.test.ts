import { test } from "vitest";
import assert from "node:assert/strict";
import { createState, planFor, runAll } from "./databases-engine";
import { ACTIONS } from "./databases-scenarios";

test("without an index, a lookup reads the whole table, and the second run reads memory", () => {
  const { state } = runAll(createState(), ACTIONS.run("find"), ACTIONS.run("find"));
  const [cold, warm] = state.runs;
  assert.equal(cold?.plan, "Seq Scan");
  assert.equal(cold?.read, 12500);
  assert.equal(cold?.examined, 1_000_000);
  assert.equal(cold?.returned, 8);
  assert.equal(warm?.read, 0);
  assert.equal(warm?.hit, 12500);
  assert.ok((warm?.ms ?? 0) < (cold?.ms ?? 0));
});

test("an index turns a full scan into a few pages", () => {
  const r = runAll(createState({ index: true }), ACTIONS.run("find")).state.runs[0];
  assert.equal(r?.plan, "Index Scan");
  assert.equal((r?.read ?? 0) + (r?.hit ?? 0), 11);
  assert.equal(r?.examined, 8);
  assert.ok((r?.ms ?? 99) < 2);
});

test("an index on customer_id doesn't help a condition on lower(email)", () => {
  assert.equal(planFor({ index: true }, "email"), "Seq Scan");
  assert.equal(runAll(createState({ index: true }), ACTIONS.run("email")).state.runs[0]?.examined, 1_000_000);
});

test("creating the index changes the plan for the next query", () => {
  const { state } = runAll(createState(), ACTIONS.index(), ACTIONS.run("find"));
  assert.equal(state.index, true);
  assert.equal(state.runs[0]?.plan, "Index Scan");
  assert.equal(state.runs[0]?.read, 0, "building it left the pages in memory");
});

test("a committed insert survives a crash when the commit waited for the log", () => {
  const { state } = runAll(createState({ commit: "sync" }), ACTIONS.run("insert"), ACTIONS.crash(), ACTIONS.run("find"));
  assert.equal(state.stats.lost, 0);
  assert.equal(state.rows, 1_000_001);
  assert.equal(state.runs[1]?.returned, 9);
  assert.equal(state.runs[1]?.hit, 0, "the crash emptied the cache");
});

test("an asynchronous commit is lost if the crash comes first, but not once the log catches up", () => {
  const lost = runAll(createState({ commit: "async" }), ACTIONS.run("insert"), ACTIONS.crash()).state;
  assert.equal(lost.stats.lost, 1);
  assert.equal(lost.rows, 1_000_000);
  const kept = runAll(createState({ commit: "async" }), ACTIONS.run("insert"), ACTIONS.run("find"), ACTIONS.crash()).state;
  assert.equal(kept.stats.lost, 0);
  assert.ok(lost.runs[0]!.ms < runAll(createState({ commit: "sync" }), ACTIONS.run("insert")).state.runs[0]!.ms);
});

test("an index makes every insert write twice", () => {
  assert.equal(runAll(createState(), ACTIONS.run("insert")).state.dirty, 1);
  assert.equal(runAll(createState({ index: true }), ACTIONS.run("insert")).state.dirty, 2);
});
