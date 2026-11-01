import { test } from "vitest";
import assert from "node:assert/strict";
import { Timeline, type TimelineOptions } from "./timeline";
import type { SimFrame } from "./simulation-types";

type F = SimFrame<{ n: number }> & { type: string };

const f = (n: number): F => ({ type: `f${n}`, state: { n }, dur: 100 });
const make = (opts: Partial<TimelineOptions<F>> = {}) => {
  const seen: string[] = [];
  const tl = new Timeline<F>({ initial: f(0), raf: null, ...opts });
  let shown = tl.frame;
  tl.subscribe(() => { if (tl.frame !== shown) { shown = tl.frame; seen.push(shown.type); } });
  return { tl, seen };
};
const run = (tl: Timeline<F>, ms: number) => { for (let i = 0; i < ms / 10; i++) tl.advance(10); };

test("plays a trace in order, then stops", () => {
  const { tl, seen } = make();
  tl.push([f(1), f(2)]);
  run(tl, 300);
  assert.deepEqual(seen, ["f1", "f2"]);
  assert.equal(tl.running, false);
});

test("pausing holds the frame; speed scales it", () => {
  const { tl } = make();
  tl.push([f(1), f(2)]);
  tl.pause();
  run(tl, 500);
  assert.equal(tl.frame.type, "f1");
  tl.setSpeed(2);
  tl.play();
  run(tl, 50);
  assert.equal(tl.frame.type, "f2");
});

test("stepping moves one frame each way and rewinding keeps the present", () => {
  const { tl } = make();
  tl.push([f(1), f(2), f(3)]);
  tl.jumpToEnd();
  tl.stepBack();
  tl.stepBack();
  assert.equal(tl.frame.type, "f1");
  assert.equal(tl.present.n, 3);
  tl.stepForward();
  run(tl, 200);
  assert.equal(tl.frame.type, "f2");
  assert.equal(tl.running, false, "a step stops after its own frame");
});

test("restart replays only the latest action", () => {
  const { tl, seen } = make();
  tl.push([f(1)]);
  run(tl, 200);
  tl.push([f(2), f(3)]);
  run(tl, 300);
  seen.length = 0;
  tl.restart();
  run(tl, 300);
  assert.deepEqual(seen, ["f2", "f3"]);
});

test("a generator supplies work, and waiting for more stays running", () => {
  let left = 2;
  const { tl } = make({ generate: () => (left-- > 0 ? [f(9)] : null) });
  tl.play();
  run(tl, 500);
  assert.equal(tl.frames.length, 3);
  assert.equal(tl.running, true);
  left = 1;
  run(tl, 200);
  assert.equal(tl.frames.length, 4);
});

test("pushing without animation lands immediately", () => {
  const { tl } = make();
  tl.push([f(1), f(2)], { animate: false });
  assert.equal(tl.frame.type, "f2");
  assert.equal(tl.running, false);
});

test("reset clears history", () => {
  const { tl } = make();
  tl.push([f(1), f(2)]);
  tl.reset(f(0));
  assert.equal(tl.frames.length, 1);
  assert.equal(tl.running, false);
});

test("dispose stops playback and the timeline can start again", () => {
  const { tl } = make();
  tl.push([f(1), f(2)]);
  tl.dispose();
  assert.equal(tl.running, false);
  tl.play();
  run(tl, 300);
  assert.equal(tl.frame.type, "f2");
});

test("progress is reported without notifying store subscribers", () => {
  const { tl } = make();
  const ts: number[] = [];
  tl.onProgress((t) => ts.push(t));
  tl.push([f(1)]);
  let renders = 0;
  tl.subscribe(() => renders++);
  run(tl, 50);
  assert.ok(ts.length > 3);
  assert.equal(renders, 0);
});
