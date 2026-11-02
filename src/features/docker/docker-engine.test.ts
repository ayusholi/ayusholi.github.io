import { test } from "vitest";
import assert from "node:assert/strict";
import { createState, imageSize, runAll, filesSeenBy } from "./docker-engine";
import { ACTIONS } from "./docker-scenarios";

test("a first run downloads every layer, a second downloads nothing", () => {
  const first = runAll(createState(), ACTIONS.run()).state;
  assert.equal(first.stats.downloadedMb, imageSize(first, "web:1.0"));
  assert.equal(first.containers[0]?.status, "running");
  const second = runAll(first, ACTIONS.run()).state;
  assert.equal(second.stats.downloadedMb, first.stats.downloadedMb);
  assert.equal(second.stats.reusedLayers, 3);
  assert.ok(runAll(first, ACTIONS.run()).frames.every((f) => f.type !== "layer.pulled"));
});

test("only layers with new content are downloaded", () => {
  const base = runAll(createState(), ACTIONS.runImage("web:1.0")).state;
  assert.equal(runAll(base, ACTIONS.runImage("web:1.1")).state.stats.downloadedMb - base.stats.downloadedMb, 2);
  assert.equal(runAll(base, ACTIONS.runImage("web:1.2")).state.stats.downloadedMb - base.stats.downloadedMb, 48);
});

test("going over the memory limit is fatal unless a policy restarts it", () => {
  const killed = runAll(createState({ memoryLimit: 128 }), ACTIONS.run(), ACTIONS.spike()).state;
  assert.equal(killed.containers[0]?.exitCode, 137);
  assert.equal(killed.stats.oomKills, 1);
  const restarted = runAll(createState({ memoryLimit: 128, restart: "always" }), ACTIONS.run(), ACTIONS.write(), ACTIONS.spike()).state;
  assert.equal(restarted.containers[0]?.status, "running");
  assert.equal(restarted.containers[0]?.restarts, 1);
  assert.equal(restarted.containers[0]?.files.length, 1, "a restart keeps the writable layer");
  const roomy = runAll(createState({ memoryLimit: 512 }), ACTIONS.run(), ACTIONS.spike()).state;
  assert.equal(roomy.containers[0]?.status, "running");
});

test("files outlive a container only in a volume", () => {
  const lost = runAll(createState(), ACTIONS.run(), ACTIONS.write(), ACTIONS.remove(), ACTIONS.run()).state;
  assert.deepEqual(filesSeenBy(lost, lost.containers[0]!), []);
  const kept = runAll(createState({ useVolume: true }), ACTIONS.run(), ACTIONS.write(), ACTIONS.remove(), ACTIONS.run()).state;
  assert.equal(filesSeenBy(kept, kept.containers[0]!).length, 1);
});

test("pruning keeps layers a container still needs", () => {
  const s = runAll(createState(), ACTIONS.runImage("web:1.0"), ACTIONS.runImage("web:1.2"), ACTIONS.remove(), ACTIONS.prune()).state;
  assert.deepEqual([...s.local].sort(), ["a1f3", "b7c2", "c9e0"]);
  assert.deepEqual(s.tags, ["web:1.0"]);
});

test("actions with nothing to act on do nothing", () => {
  assert.equal(ACTIONS.write()(createState()), null);
  assert.equal(ACTIONS.spike()(createState()), null);
  assert.equal(ACTIONS.remove()(createState()), null);
});
