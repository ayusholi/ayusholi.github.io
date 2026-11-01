import { test } from "vitest";
import assert from "node:assert/strict";
import type { RedisFrame, RedisState } from "./redis-types";
import { createState, get, advanceClock, updateRecord, setRedisUp, flush, configure, stampede, run, isLive } from "./redis-engine";

const KEY = "user:42";
const types = (frames: RedisFrame[]) => frames.map((f) => f.type);
const last = (s: RedisState) => s.history[s.history.length - 1]!;
const GET = (s: RedisState) => get(s, KEY);

test("a first request misses, queries Postgres and fills the cache", () => {
  const { state, frames } = run(createState(), GET);
  assert.ok(types(frames).includes("cache.miss"));
  assert.ok(types(frames).includes("db.query"));
  assert.ok(types(frames).includes("cache.write"));
  assert.equal(state.stats.misses, 1);
  assert.equal(state.stats.dbQueries, 1);
  assert.equal(last(state).elapsed, 150);
  assert.equal(last(state).reason, "missing");
  assert.ok(state.cache[KEY]);
});

test("a second request hits and never reaches Postgres", () => {
  const first = run(createState(), GET);
  const { state, frames } = run(first.state, GET);
  assert.equal(state.stats.hits, 1);
  assert.equal(state.stats.dbQueries, 1, "no extra query");
  assert.equal(last(state).elapsed, 5);
  assert.ok(!frames.some((f) => f.packets.some((p) => p.to === "db")), "no packet travels to the database");
});

test("every frame's packets agree with the state they sit in", () => {
  const { frames } = run(createState(), GET, GET);
  const hit = frames.find((f) => f.type === "cache.hit")!;
  const miss = frames.find((f) => f.type === "cache.miss")!;
  assert.equal(miss.packets[0]!.label, "(nil)");
  assert.equal(miss.state.stats.misses, 1);
  assert.match(hit.packets[0]!.label, /Asha/);
  assert.equal(hit.state.stats.hits, 1);
});

test("the homepage topology adds Nginx hops and keeps the logic", () => {
  const { state, frames } = run(createState({ edge: true }), GET, GET);
  assert.ok(frames.some((f) => f.packets.some((p) => p.from === "edge" && p.to === "app")));
  assert.equal(state.history[0]!.elapsed, 152);
  assert.equal(state.history[1]!.elapsed, 7);
});

test("a key is readable just before its TTL and not at it", () => {
  const start = run(createState({ ttl: 30 }), GET);
  const before = run(start.state, (s: RedisState) => advanceClock(s, 29), GET);
  assert.equal(before.state.stats.hits, 1);
  const after = run(start.state, (s: RedisState) => advanceClock(s, 30), GET);
  assert.equal(after.state.stats.hits, 0);
  assert.equal(after.state.stats.misses, 2);
  assert.equal(last(after.state).reason, "expired");
  assert.ok(isLive(after.state.cache[KEY], after.state.now), "the miss rewrites the entry with a fresh TTL");
});

test("an expired entry lingers until touched but cannot be read", () => {
  const { state } = run(createState({ ttl: 10 }), GET, (s: RedisState) => advanceClock(s, 11));
  assert.ok(state.cache[KEY]);
  assert.equal(isLive(state.cache[KEY], state.now), false);
});

test("changing the TTL only affects later writes", () => {
  const { state } = run(createState({ ttl: 10 }), GET, (s: RedisState) => configure(s, { ttl: 300 }), (s: RedisState) => advanceClock(s, 11), GET);
  assert.equal(state.stats.misses, 2);
  const fresh = run(state, (s: RedisState) => advanceClock(s, 200), GET);
  assert.equal(fresh.state.stats.hits, 1);
});

test("delete-on-write leaves no stale read", () => {
  const { state } = run(createState(), GET, (s: RedisState) => updateRecord(s, KEY, { plan: "pro" }), GET);
  assert.equal(state.stats.stale, 0);
  assert.equal(last(state).value!.plan, "pro");
  assert.equal(state.stats.misses, 2);
});

test("skipping invalidation serves stale data until the TTL runs out", () => {
  const stale = run(createState({ invalidation: "none", ttl: 60 }), GET, (s: RedisState) => updateRecord(s, KEY, { plan: "pro" }), GET);
  assert.equal(last(stale.state).status, "stale");
  assert.equal(last(stale.state).value!.plan, "free");
  assert.equal(stale.state.stats.stale, 1);
  const healed = run(stale.state, (s: RedisState) => advanceClock(s, 61), GET);
  assert.equal(last(healed.state).value!.plan, "pro");
});

test("with Redis down, fallback serves from Postgres and writes nothing", () => {
  const { state } = run(createState(), GET, (s: RedisState) => setRedisUp(s, false), GET);
  assert.equal(last(state).status, "bypass");
  assert.equal(last(state).elapsed, 198);
  assert.equal(state.stats.failed, 0);
  assert.equal(state.stats.dbQueries, 2);
  assert.equal(state.stats.hits + state.stats.misses, 1, "a failed lookup is neither a hit nor a miss");
});

test("with Redis down, strict policy fails the request and spares Postgres", () => {
  const { state } = run(createState({ policy: "strict" }), (s: RedisState) => setRedisUp(s, false), GET);
  assert.equal(last(state).status, "failed");
  assert.equal(state.stats.failed, 1);
  assert.equal(state.stats.dbQueries, 0);
});

test("a write during an outage cannot invalidate, and restart comes back empty", () => {
  const down = run(createState(), GET, (s: RedisState) => setRedisUp(s, false), (s: RedisState) => updateRecord(s, KEY, { plan: "pro" }));
  assert.ok(down.frames.some((f) => f.type === "invalidate.failed"));
  const up = run(down.state, (s: RedisState) => setRedisUp(s, true), GET);
  assert.equal(last(up.state).value!.plan, "pro");
  assert.equal(last(up.state).status, "miss");
});

test("flush empties the keyspace", () => {
  const { state } = run(createState(), GET, flush, GET);
  assert.equal(state.stats.misses, 2);
});

test("a stampede costs one query per request unless it is single-flighted", () => {
  const open = run(createState(), (s: RedisState) => stampede(s, KEY, 8, false));
  assert.equal(open.state.stats.dbQueries, 8);
  const guarded = run(createState(), (s: RedisState) => stampede(s, KEY, 8, true));
  assert.equal(guarded.state.stats.dbQueries, 1);
  assert.equal(guarded.state.stats.requests, 8);
});

test("a stampede needs a cold key", () => {
  const warm = run(createState(), GET);
  assert.equal(stampede(warm.state, KEY, 8, false), null);
});

test("actions never mutate the state they are given", () => {
  const s = createState();
  const snapshot = structuredClone(s);
  run(s, GET, GET, (x: RedisState) => updateRecord(x, KEY, { plan: "pro" }));
  assert.deepEqual(s, snapshot);
});

test("a fresh state is identical however the simulation was used before", () => {
  run(createState(), GET, (s) => advanceClock(s, 90), (s) => setRedisUp(s, false));
  assert.deepEqual(createState(), createState());
  assert.equal(JSON.stringify(createState().db), JSON.stringify(createState().db));
});

test("the same inputs always give the same frames", () => {
  const script = (s: RedisState) => run(s, GET, (x) => advanceClock(x, 61), GET, (x) => updateRecord(x, KEY, { plan: "pro" }), GET);
  assert.deepEqual(script(createState()).frames, script(createState()).frames);
});

test("latency values are configurable, and only change timing", () => {
  const slow = run(createState({ latency: { client: 10, edge: 1, redis: 1, db: 100, redisTimeout: 50 } }), GET);
  assert.equal(last(slow.state).elapsed, 224);
  assert.equal(slow.state.stats.misses, 1);
});
