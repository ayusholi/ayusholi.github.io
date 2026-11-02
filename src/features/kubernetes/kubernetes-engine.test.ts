import { test } from "vitest";
import assert from "node:assert/strict";
import * as engine from "./kubernetes-engine";
import type { K8sState } from "./kubernetes-types";

const after = (s: K8sState, frames: { state: K8sState }[]) => frames[frames.length - 1]?.state ?? s;
const steady = (desired = 3) => engine.converge(engine.createState({ desired }));

test("an empty cluster converges to the spec, spread across nodes", () => {
  const s = steady();
  assert.equal(engine.reportedReady(s), 3);
  assert.deepEqual(engine.WORKERS.map((w) => engine.load(s, w)), [1, 1, 1]);
  assert.equal(engine.tick(s), null, "a converged cluster has nothing to do");
});

test("a deleted pod is replaced without being asked", () => {
  const s = engine.converge(after(steady(), engine.deletePod(steady())));
  assert.equal(engine.reportedReady(s), 3);
  assert.equal(s.stats.created, 4);
  assert.ok(s.pods.every((p) => p.phase === "Running"));
});

test("a dead node is trusted, then distrusted, then emptied", () => {
  let s = after(steady(), engine.failNode(steady(), "node2"));
  assert.equal(engine.reportedReady(s), 3);
  assert.equal(engine.serving(s), 2, "its pod looks ready but serves nothing");
  s = engine.ticks(s, engine.NOT_READY_AFTER);
  assert.equal(engine.worker(s, "node2")?.ready, false);
  assert.equal(engine.reportedReady(s), 2);
  s = engine.converge(s);
  assert.equal(engine.serving(s), 3);
  assert.equal(engine.load(s, "node2"), 0);
  assert.equal(s.stats.evicted, 1);
  s = engine.converge(after(s, engine.restoreNode(s, "node2")));
  assert.equal(engine.worker(s, "node2")?.ready, true);
  assert.equal(engine.load(s, "node2"), 0, "nothing moves back by itself");
});

test("pods that don't fit stay pending", () => {
  const s = engine.converge(after(steady(), engine.scale(steady(), 10)));
  assert.equal(engine.reportedReady(s), 9);
  assert.equal(engine.pending(s), 1);
  assert.ok(s.events.some((e) => e.reason === "FailedScheduling"));
  const fewer = engine.converge(after(s, engine.scale(s, 9)));
  assert.equal(engine.pending(fewer), 0, "the unplaced pod is the first to go");
});

test("a rolling update never drops below the desired ready count", () => {
  let s = after(steady(), engine.setImage(steady(), "v2"));
  for (let i = 0; i < 60; i++) {
    const out = engine.tick(s);
    if (!out) break;
    for (const f of out) {
      assert.ok(engine.reportedReady(f.state) >= 3, `ready fell to ${engine.reportedReady(f.state)} at tick ${f.state.tick}`);
      assert.ok(engine.live(f.state).length <= 3 + engine.MAX_SURGE);
    }
    s = after(s, out);
  }
  assert.ok(engine.live(s).every((p) => p.version === "v2"));
  assert.equal(engine.reportedReady(s), 3);
});

test("a broken image stalls the rollout, and undo cleans it up", () => {
  const stalled = engine.converge(after(steady(), engine.setImage(steady(), "v3")));
  assert.equal(engine.live(stalled).filter((p) => p.version === "v1" && p.ready).length, 3);
  assert.equal(engine.live(stalled).filter((p) => p.phase === "ImagePullBackOff").length, 1);
  const undone = engine.converge(after(stalled, engine.undo(stalled)));
  assert.ok(engine.live(undone).every((p) => p.version === "v1" && p.ready));
  assert.equal(engine.live(undone).length, 3);
});
