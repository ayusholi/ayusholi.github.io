import { test } from "vitest";
import assert from "node:assert/strict";
import { text } from "./llm-engine";
import { buildScenario, SCENARIOS, type ScenarioId } from "./llm-scenarios";

const end = (id: ScenarioId) => {
  const { state, frames } = buildScenario(id);
  return frames[frames.length - 1]?.state ?? state;
};

test("each scenario shows what its lesson claims", () => {
  assert.equal(text(end("next")), " Paris.");
  assert.ok(end("temperature").stats.offTop >= 1);
  assert.equal(text(end("recall")), " Ayush.");
  assert.ok(end("forget").stats.dropped > 0 && !text(end("forget")).includes("Ayush"));
  assert.ok(end("invent").stats.unsure >= 1);
});

test("running a scenario twice gives the same frames", () => {
  for (const id of Object.keys(SCENARIOS) as ScenarioId[]) assert.deepEqual(buildScenario(id), buildScenario(id));
});
