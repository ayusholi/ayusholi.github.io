// Run with: node --test "how/test/*.test.js"
import test from "node:test";
import assert from "node:assert/strict";
import { Timeline } from "../js/core/timeline.js";

const f = (n) => ({ type: `f${n}`, state: { n }, dur: 100 });
const make = (opts = {}) => {
  const seen = [];
  const tl = new Timeline({ initial: f(0), raf: null, onFrame: (fr) => seen.push(fr.type), ...opts });
  return { tl, seen };
};
const run = (tl, ms) => { for (let i = 0; i < ms / 10; i++) tl.advance(10); };

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
