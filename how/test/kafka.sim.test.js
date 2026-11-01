// Run with: node --test "how/test/*.test.js"
import test from "node:test";
import assert from "node:assert/strict";
import {
  createState, produce, produceMany, tick, ticks, drain, repeat, lastState, addConsumer, removeConsumer, pauseConsumer,
  resumeConsumer, crashConsumer, seek, addPartition, computeAssignment, maxActiveConsumers, partitionFor, lag, totalLag,
  activeConsumers, configure, SESSION_TIMEOUT_TICKS, MAX_PARTITIONS,
} from "../kafka/sim.js";

const withRecords = (opts, n) => lastState(produceMany(createState(opts), n));
const settle = (s) => ticks(s, 2);

test("offsets count up from zero inside each partition", () => {
  const s = withRecords({}, 12);
  for (const p of s.partitions) p.records.forEach((r, i) => assert.equal(r.offset, i));
  assert.equal(s.partitions.reduce((n, p) => n + p.records.length, 0), 12);
});

test("the same key always lands in the same partition", () => {
  const s = withRecords({ partitions: 4 }, 30);
  for (const p of s.partitions) {
    for (const r of p.records) assert.equal(r.partition, partitionFor(r.key, 4));
  }
});

test("a key's records are applied in order when keyed", () => {
  const s = drain(withRecords({ partitions: 3, consumers: 3 }, 30));
  assert.equal(s.stats.outOfOrder, 0);
  for (const key of ["A", "B", "C"]) {
    const seqs = s.applied.filter((a) => a.key === key).map((a) => Number(a.id.slice(1)));
    assert.deepEqual(seqs, [...seqs].sort((a, b) => a - b));
  }
});

test("without keys a topic has no order across partitions", () => {
  // Give p0 a head start of nothing: pause its owner so later records in p1 overtake.
  let s = lastState(configure(createState({ partitions: 2, consumers: 2, keyed: false }), {}));
  s = lastState(pauseConsumer(s, "c1"));
  s = repeat(s, produce, 12);
  s = ticks(s, 6);
  s = lastState(resumeConsumer(s, "c1"));
  s = drain(s);
  assert.ok(s.stats.outOfOrder > 0);
  for (const p of s.partitions) {
    const seen = s.applied.filter((a) => a.partition === p.records[0].partition).map((a) => a.offset);
    assert.deepEqual(seen, [...seen].sort((a, b) => a - b), "still ordered within a partition");
  }
});

test("the Ordering lesson holds: keyless records overtake with no pausing at all", () => {
  let s = drain(lastState(produceMany(createState({ partitions: 3, consumers: 3, keyed: false }), 18)));
  assert.ok(s.stats.outOfOrder > 0);
  const keyed = drain(lastState(produceMany(createState({ partitions: 3, consumers: 3 }), 18)));
  assert.equal(keyed.stats.outOfOrder, 0);
});

test("each partition has exactly one owner and consumers are balanced", () => {
  for (let parts = 1; parts <= 8; parts++) {
    for (let cons = 1; cons <= 6; cons++) {
      const owners = computeAssignment(parts, Array.from({ length: cons }, (_, i) => `c${i}`));
      assert.ok(owners.every(Boolean));
      const load = Object.values(owners.reduce((m, o) => ({ ...m, [o]: (m[o] || 0) + 1 }), {}));
      assert.ok(Math.max(...load) - Math.min(...load) <= 1);
    }
  }
});

test("consumers beyond the partition count sit idle", () => {
  assert.equal(maxActiveConsumers(6, 8), 6);
  assert.equal(maxActiveConsumers(6, 3), 3);
  const s = createState({ partitions: 2, consumers: 5 });
  assert.equal(activeConsumers(s), 2);
});

test("more consumers finish the same backlog in fewer ticks, up to the partition count", () => {
  const ticksFor = (consumers) => {
    let s = withRecords({ partitions: 3, consumers }, 30);
    let n = 0;
    while (tick(s)) { s = lastState(tick(s)); n++; }
    return n;
  };
  assert.ok(ticksFor(3) < ticksFor(1));
  assert.equal(ticksFor(6), ticksFor(3));
});

test("lag is the distance from the log end to the committed offset", () => {
  let s = lastState(pauseConsumer(createState({ partitions: 1, consumers: 1 }), "c1"));
  s = repeat(s, produce, 5);
  assert.equal(lag(s.partitions[0]), 5);
  s = lastState(resumeConsumer(s, "c1"));
  s = drain(s);
  assert.equal(lag(s.partitions[0]), 0);
});

test("a paused consumer keeps its partitions, so its lag grows", () => {
  let s = lastState(pauseConsumer(createState({ partitions: 2, consumers: 2 }), "c1"));
  const owners = s.partitions.map((p) => p.owner);
  s = repeat(s, produce, 12);
  s = drain(s);
  assert.deepEqual(s.partitions.map((p) => p.owner), owners);
  assert.ok(totalLag(s) > 0);
  assert.equal(s.generation, 1, "no rebalance");
});

test("a crashed consumer keeps its partitions until the session times out", () => {
  let s = lastState(crashConsumer(createState({ partitions: 2, consumers: 2 }), "c1"));
  s = ticks(s, SESSION_TIMEOUT_TICKS - 1);
  assert.ok(s.partitions.some((p) => p.owner === "c1"));
  s = ticks(s, 1);
  assert.ok(s.rebalancing > 0);
  s = settle(s);
  assert.ok(s.partitions.every((p) => p.owner === "c2"));
  assert.equal(s.rebalancing, 0);
});

test("crashing mid-batch reprocesses records under at-least-once", () => {
  let s = withRecords({ partitions: 1, consumers: 2, commitEvery: 5 }, 10);
  s = ticks(s, 3);
  const owner = s.partitions[0].owner;
  assert.equal(s.partitions[0].position, 3);
  assert.equal(s.partitions[0].committed, 0);
  s = lastState(crashConsumer(s, owner));
  s = drain(s);
  assert.equal(s.stats.duplicates, 3);
  assert.equal(s.stats.lost, 0);
  assert.equal(s.partitions[0].position, 10);
});

test("committing before processing can lose records instead", () => {
  let s = withRecords({ partitions: 1, consumers: 2, commitEvery: 5, commitMode: "before" }, 10);
  s = ticks(s, 2);
  assert.equal(s.partitions[0].committed, 5);
  s = lastState(crashConsumer(s, s.partitions[0].owner));
  s = drain(s);
  assert.equal(s.stats.duplicates, 0);
  assert.equal(s.stats.lost, 3);
  const heard = new Set(s.applied.map((a) => a.id));
  assert.equal(heard.size, 7);
});

test("an idempotent sink still receives duplicates but skips their effect", () => {
  let s = withRecords({ partitions: 1, consumers: 2, commitEvery: 5, idempotent: true }, 6);
  s = ticks(s, 3);
  s = lastState(crashConsumer(s, s.partitions[0].owner));
  s = drain(s);
  assert.equal(s.stats.duplicates, 3);
  assert.equal(s.applied.filter((a) => a.skipped).length, 3);
});

test("a clean shutdown commits its progress, so nothing repeats", () => {
  let s = withRecords({ partitions: 1, consumers: 2, commitEvery: 5 }, 10);
  s = ticks(s, 3);
  s = lastState(removeConsumer(s, s.partitions[0].owner));
  s = drain(s);
  assert.equal(s.stats.duplicates, 0);
});

test("seeking replays records without removing anything from the log", () => {
  let s = drain(withRecords({ partitions: 1, consumers: 1 }, 6));
  const before = s.partitions[0].records.length;
  s = lastState(seek(s, 0, 2));
  assert.equal(s.partitions[0].records.length, before);
  s = drain(s);
  assert.equal(s.stats.delivered, 10);
  assert.equal(s.stats.duplicates, 4);
});

test("adding a partition rebalances and can move a key", () => {
  let s = createState({ partitions: 3 });
  const moved = ["A", "B", "C"].some((k) => partitionFor(k, 3) !== partitionFor(k, 4));
  assert.ok(moved, "at least one demo key moves, or the lesson would not show");
  s = lastState(addPartition(s));
  assert.ok(s.rebalancing > 0);
  s = settle(s);
  assert.equal(s.partitions.length, 4);
  assert.ok(s.partitions.every((p) => p.owner));
});

test("partition count is capped and joining mid-stream resumes from committed", () => {
  let s = createState({ partitions: MAX_PARTITIONS });
  assert.deepEqual(addPartition(s), []);
  s = withRecords({ partitions: 2, consumers: 1, commitEvery: 4 }, 12);
  s = ticks(s, 2);
  s = lastState(addConsumer(s));
  s = drain(s);
  assert.equal(s.partitions.reduce((n, p) => n + lag(p), 0), 0);
});

test("an idle group produces no frames", () => {
  assert.equal(tick(createState()), null);
});

test("no group members: partitions wait unowned and lose nothing", () => {
  let s = withRecords({ partitions: 2, consumers: 1 }, 6);
  s = lastState(removeConsumer(s, "c1"));
  s = settle(s);
  assert.ok(s.partitions.every((p) => p.owner === null));
  assert.equal(totalLag(s), 6);
  s = lastState(addConsumer(s));
  s = drain(s);
  assert.equal(totalLag(s), 0);
});

test("actions never mutate the state they are given", () => {
  const s = withRecords({}, 4);
  const snapshot = structuredClone(s);
  tick(s); produce(s); crashConsumer(s, "c1"); addPartition(s); seek(s, 0, 0);
  assert.deepEqual(s, snapshot);
});
