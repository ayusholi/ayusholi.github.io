import { test } from "vitest";
import assert from "node:assert/strict";
import * as engine from "./actions-engine";
import type { ActionsState, Trigger } from "./actions-types";

const push = (s: ActionsState, t: Partial<Trigger> = {}) => engine.lastState(engine.trigger(s, t), s);
const run = (t: Partial<Trigger> = {}, s = engine.createState()) => engine.settle(push(s, t));
const status = (s: ActionsState) => Object.fromEntries(engine.latest(s)!.jobs.map((j) => [j.id, j.status]));

test("a push to main runs every job, in the order needs allows", () => {
  let s = push(engine.createState());
  const startedAt: Record<string, number> = {};
  for (let i = 0; i < 100; i++) {
    const out = engine.tick(s);
    if (!out) break;
    s = engine.lastState(out, s);
    for (const j of engine.latest(s)!.jobs) if (j.status === "running") startedAt[j.id] ??= s.tick;
  }
  assert.deepEqual(status(s), { "test-20": "success", "test-22": "success", build: "success", deploy: "success" });
  assert.equal(startedAt["test-20"], startedAt["test-22"], "the matrix runs side by side");
  assert.ok(startedAt.build! > startedAt["test-22"]!);
  assert.ok(startedAt.deploy! > startedAt.build!);
  assert.equal(engine.latest(s)?.status, "success");
});

test("a pull request skips deploy without failing", () => {
  const s = run({ event: "pull_request", ref: "feature/x" });
  assert.equal(status(s).deploy, "skipped");
  assert.equal(engine.latest(s)?.status, "success");
});

test("a failing test cancels its matrix sibling and skips what depends on it", () => {
  const s = run({ failing: true });
  const jobs = status(s);
  assert.equal(Object.values(jobs).filter((x) => x === "failure").length, 1);
  assert.equal(Object.values(jobs).filter((x) => x === "cancelled").length, 1);
  assert.equal(jobs.build, "skipped");
  assert.equal(jobs.deploy, "skipped");
  assert.equal(engine.latest(s)?.status, "failure");
});

test("a newer push cancels the older run in the same group", () => {
  const busy = engine.ticks(push(engine.createState()), 4);
  const s = engine.settle(push(busy));
  assert.equal(s.runs[0]?.status, "cancelled");
  assert.equal(s.runs[1]?.status, "success");
  assert.ok(s.stats.cancelled > 0);
  assert.ok(s.runners.every((r) => r.job === null), "cancelled jobs release their runners");
});

test("a new lockfile misses the cache, saves it, and the next run hits", () => {
  const first = run({ deps: true });
  assert.equal(first.stats.misses, 2, "both matrix legs miss at once");
  assert.equal(first.stats.hits, 1, "build starts after the save, so it hits");
  assert.ok(first.cache.includes(engine.cacheKey(2)));
  const warm = run({}, first);
  assert.equal(warm.stats.hits - first.stats.hits, 3);
  assert.ok(warm.stats.minutes - first.stats.minutes < first.stats.minutes, "a warm run bills fewer ticks");
});

test("a docs-only push starts nothing", () => {
  const s = push(engine.createState(), { docs: true });
  assert.equal(s.runs.length, 0);
  assert.equal(engine.tick(s), null);
});

test("fewer runners means jobs wait in the queue", () => {
  const one = run({}, engine.createState({ capacity: 1 }));
  const two = run({}, engine.createState({ capacity: 2 }));
  assert.ok(one.tick > two.tick, "same work, longer wall time");
  assert.equal(one.stats.minutes, two.stats.minutes, "same billed time");
});
