import { test } from "vitest";
import assert from "node:assert/strict";
import { activeConsumers, drain, totalLag } from "./kafka-engine";
import { buildExperiment, EXPERIMENTS, type ExperimentId } from "./kafka-scenarios";

test("each experiment shows what its lesson claims", () => {
  assert.equal(drain(buildExperiment("ordering")).stats.outOfOrder, 0);
  const scale = buildExperiment("scale");
  assert.equal(activeConsumers(scale), 2);
  assert.equal(scale.consumers.length, 5);
  assert.ok(totalLag(drain(buildExperiment("lag"))) > 0);
  assert.ok(drain(buildExperiment("crash")).stats.duplicates > 0);
  assert.equal(totalLag(buildExperiment("replay")), 0);
});

test("running an experiment twice gives the same state", () => {
  for (const id of Object.keys(EXPERIMENTS) as ExperimentId[]) assert.deepEqual(buildExperiment(id), buildExperiment(id));
});
