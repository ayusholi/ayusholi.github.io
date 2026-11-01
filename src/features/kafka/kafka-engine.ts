// =========================================================
// Kafka topic and consumer-group simulation. Pure: no DOM, no timers.
//
// Models records appended to partitions, one consumer group with
// offset commits, rebalancing, and a sink that shows what the
// application actually did with each record.
// See kafka-engine.test.ts.
//
// Simplified on purpose: one broker's view (no replication), one group,
// a processing "tick" instead of real time, a small keyed hash instead of
// murmur2, and very short sticky batches for keyless records. Eager stop-the-world rebalancing is shown; modern clients can
// rebalance incrementally.
// =========================================================

import type {
  AppliedRecord, CommitNote, Consumer, KafkaConfig, KafkaEventType, KafkaFrame, KafkaOptions, KafkaPacket, KafkaRecord, KafkaState, Partition, RecordKey,
} from "./kafka-types";

export const MAX_PARTITIONS = 8;
export const MAX_CONSUMERS = 6;
export const SESSION_TIMEOUT_TICKS = 3;
export const REBALANCE_TICKS = 2;
export const STICKY_BATCH = 2;   // keyless records written to a partition before moving on

export const KEYS: RecordKey[] = ["A", "B", "C"];

const makeConsumer = (id: string): Consumer => ({ id, status: "running", missed: 0, cursor: 0 });

const blankPartition = (): Partition => ({ records: [], position: 0, committed: 0, batchEnd: 0, owner: null });

export const createState = ({ partitions = 3, consumers = 2, commitEvery = 3, commitMode = "after", idempotent = false, keyed = true }: KafkaOptions = {}): KafkaState => {
  const state: KafkaState = {
    partitions: Array.from({ length: partitions }, blankPartition),
    consumers: Array.from({ length: consumers }, (_, i) => makeConsumer(`c${i + 1}`)),
    nextConsumer: consumers + 1,
    generation: 1,
    rebalancing: 0,        // ticks of stop-the-world left
    commitEvery,           // records per poll, then commit
    commitMode,            // "after" (at-least-once) | "before" (at-most-once)
    idempotent,            // the sink ignores records it has already applied
    keyed,                 // records carry a key
    tick: 0,
    produced: 0,
    robin: 0,
    sequence: { A: 0, B: 0, C: 0 },
    applied: [],           // what the application did, in order
    counts: {},            // record id -> times delivered to the application
    lastByKey: {},         // key -> highest sequence applied
    stats: { delivered: 0, duplicates: 0, lost: 0, outOfOrder: 0 },
  };
  return { ...state, ...assign(state) };
};

// Paused consumers are still members (they keep polling and heartbeating).
// Crashed ones stay listed until their session expires, then they're removed.
export const members = (s: KafkaState) => s.consumers;

// Range-like assignment: partitions spread evenly, each with exactly one owner.
export const computeAssignment = <Id,>(partitionCount: number, memberIds: Id[]): (Id | null)[] => {
  const owners: (Id | null)[] = Array<Id | null>(partitionCount).fill(null);
  if (!memberIds.length) return owners;
  const base = Math.floor(partitionCount / memberIds.length);
  const extra = partitionCount % memberIds.length;
  let p = 0;
  memberIds.forEach((id, i) => {
    const share = base + (i < extra ? 1 : 0);
    for (let n = 0; n < share; n++) owners[p++] = id;
  });
  return owners;
};

// The most consumers of one group that can be active on a topic at once.
export const maxActiveConsumers = (partitionCount: number, consumerCount: number) =>
  new Set(computeAssignment(partitionCount, Array.from({ length: consumerCount }, (_, i) => i)).filter((o) => o !== null)).size;

const assign = (s: KafkaState) => {
  const owners = computeAssignment(s.partitions.length, members(s).map((c) => c.id));
  return {
    partitions: s.partitions.map((p, i) => ({
      ...p,
      owner: owners[i] ?? null,
      // a new owner starts from the last committed offset, not the old position
      position: owners[i] === p.owner ? p.position : p.committed,
      batchEnd: owners[i] === p.owner ? p.batchEnd : p.committed,
    })),
  };
};

// Small stable hash. Same key, same partition, for a fixed partition count.
export const hashKey = (key: string) => [...key].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
export const partitionFor = (key: string, count: number) => hashKey(key) % count;

export const lag = (p: Partition) => p.records.length - p.committed;
export const totalLag = (s: KafkaState) => s.partitions.reduce((sum, p) => sum + lag(p), 0);
export const activeConsumers = (s: KafkaState) => new Set(s.partitions.map((p) => p.owner).filter(Boolean)).size;

const frame = (type: KafkaEventType, state: KafkaState, meta: Partial<Omit<KafkaFrame, "type" | "state">> = {}): KafkaFrame => ({ type, state, packets: [], dur: 500, ...meta });

const setPartition = (s: KafkaState, index: number, patch: Partial<Partition>): KafkaState => ({
  ...s,
  partitions: s.partitions.map((p, i) => (i === index ? { ...p, ...patch } : p)),
});

// ---------- Producer ----------
export const produce = (state: KafkaState, key: RecordKey | null = null): KafkaFrame[] => {
  const k = key ?? (KEYS[state.produced % KEYS.length] as RecordKey);
  const seq = state.sequence[k] + 1;
  const index = state.keyed ? partitionFor(k, state.partitions.length) : Math.floor(state.robin / STICKY_BATCH) % state.partitions.length;
  const part = state.partitions[index] as Partition;
  const record: KafkaRecord = { id: `${k}${seq}`, key: k, seq, offset: part.records.length, partition: index };
  let s = setPartition(state, index, { records: [...part.records, record] });
  s = {
    ...s,
    produced: s.produced + 1,
    robin: s.robin + 1,
    sequence: { ...s.sequence, [k]: seq },
  };
  return [frame("record.produced", s, { dur: 520, record, packets: [{ kind: "produce", record, partition: index }] })];
};

export const produceMany = (state: KafkaState, count: number): KafkaFrame[] => {
  let s = state;
  const frames: KafkaFrame[] = [];
  for (let i = 0; i < count; i++) {
    const f = produce(s)[0] as KafkaFrame;
    s = f.state;
    frames.push({ ...f, dur: 150 });
  }
  return frames;
};

// ---------- Consumers ----------
const commit = (s: KafkaState, index: number, to: number) => setPartition(s, index, { committed: Math.max(0, to) });

// What the application does with one record.
const apply = (s: KafkaState, record: KafkaRecord, consumer: string): KafkaState => {
  const count = (s.counts[record.id] || 0) + 1;
  const duplicate = count > 1;
  const skipped = duplicate && s.idempotent;
  const last = s.lastByKey[record.key] || 0;
  const outOfOrder = !duplicate && record.seq < last;
  return {
    ...s,
    counts: { ...s.counts, [record.id]: count },
    lastByKey: { ...s.lastByKey, [record.key]: Math.max(last, record.seq) },
    applied: [...s.applied, { id: record.id, key: record.key, partition: record.partition, offset: record.offset, consumer, duplicate, skipped, outOfOrder } satisfies AppliedRecord].slice(-40),
    stats: {
      ...s.stats,
      delivered: s.stats.delivered + 1,
      duplicates: s.stats.duplicates + (duplicate ? 1 : 0),
      outOfOrder: s.stats.outOfOrder + (outOfOrder ? 1 : 0),
    },
  };
};

const hasWork = (s: KafkaState) =>
  s.rebalancing > 0 ||
  s.consumers.some((c) => c.status === "crashed") ||
  s.partitions.some((p) => p.owner && p.position < p.records.length && ownerRunning(s, p));

const ownerRunning = (s: KafkaState, p: Partition) => s.consumers.find((c) => c.id === p.owner)?.status === "running";

// One unit of simulated time: every running consumer handles one record.
// Returns null when nothing would change, so an idle simulation costs nothing.
export const tick = (state: KafkaState): KafkaFrame[] | null => {
  if (!hasWork(state)) return null;
  let s = { ...state, tick: state.tick + 1 };
  const packets: KafkaPacket[] = [];
  const commits: CommitNote[] = [];

  // A crashed member stops heartbeating. It only leaves once the session expires.
  s = { ...s, consumers: s.consumers.map((c) => (c.status === "crashed" ? { ...c, missed: c.missed + 1 } : c)) };
  const expired = s.consumers.filter((c) => c.status === "crashed" && c.missed >= SESSION_TIMEOUT_TICKS);
  if (expired.length) {
    s = { ...s, consumers: s.consumers.filter((c) => !expired.includes(c)) };
    return [frame("session.expired", startRebalance(s), { dur: 700, gone: expired.map((c) => c.id) })];
  }

  if (s.rebalancing > 0) {
    s = { ...s, rebalancing: s.rebalancing - 1 };
    if (s.rebalancing === 0) {
      s = { ...s, ...assign(s) };
      s = markLost(s);
      return [frame("rebalance.done", s, { dur: 700 })];
    }
    return [frame("rebalance.running", s, { dur: 600 })];
  }

  const nextConsumers: Consumer[] = [];
  for (const consumer of s.consumers) {
    if (consumer.status !== "running") { nextConsumers.push(consumer); continue; }
    const owned = s.partitions.map((p, i) => ({ p, i })).filter(({ p }) => p.owner === consumer.id);
    // Take turns across assigned partitions, starting after the last one served.
    const ready = owned.filter(({ p }) => p.position < p.records.length);
    if (!ready.length) { nextConsumers.push(consumer); continue; }
    const { p, i } = (ready.find(({ i }) => i >= consumer.cursor) ?? ready[0]) as { p: Partition; i: number };

    // A poll hands over a batch. "before" commits it the moment it arrives.
    let batchEnd = p.batchEnd;
    if (p.position >= batchEnd) {
      batchEnd = Math.min(p.records.length, p.position + s.commitEvery);
      s = setPartition(s, i, { batchEnd });
      if (s.commitMode === "before") {
        s = commit(s, i, batchEnd);
        commits.push({ partition: i, offset: batchEnd, consumer: consumer.id, early: true });
      }
    }

    const record = p.records[p.position] as KafkaRecord;
    s = apply(s, record, consumer.id);
    const position = p.position + 1;
    s = setPartition(s, i, { position });
    packets.push({ kind: "consume", record, partition: i, consumer: consumer.id, duplicate: (s.counts[record.id] || 0) > 1 });

    if (s.commitMode === "after" && position >= batchEnd) {
      s = commit(s, i, position);
      commits.push({ partition: i, offset: position, consumer: consumer.id });
    }
    nextConsumers.push({ ...consumer, cursor: i + 1 });
  }
  s = { ...s, consumers: nextConsumers };
  return [frame("consumers.tick", s, { dur: 620, packets, commits })];
};

// Records the group has moved past without the application ever seeing them.
const markLost = (s: KafkaState): KafkaState => {
  let lost = 0;
  for (const p of s.partitions) {
    for (const r of p.records.slice(0, p.committed)) if (!s.counts[r.id]) lost++;
  }
  return { ...s, stats: { ...s.stats, lost } };
};

const startRebalance = (s: KafkaState): KafkaState => ({ ...s, generation: s.generation + 1, rebalancing: REBALANCE_TICKS });

export const addConsumer = (state: KafkaState): KafkaFrame[] => {
  if (state.consumers.length >= MAX_CONSUMERS) return [];
  const c = makeConsumer(`c${state.nextConsumer}`);
  const s = startRebalance({ ...state, consumers: [...state.consumers, c], nextConsumer: state.nextConsumer + 1 });
  return [frame("consumer.joined", s, { dur: 600, consumer: c.id })];
};

// A clean shutdown commits what it finished and tells the group straight away.
export const removeConsumer = (state: KafkaState, id: string): KafkaFrame[] => {
  if (!state.consumers.some((c) => c.id === id)) return [];
  const partitions = state.partitions.map((p) => (p.owner === id ? { ...p, committed: Math.max(p.committed, p.position) } : p));
  const s = startRebalance({ ...state, partitions, consumers: state.consumers.filter((c) => c.id !== id) });
  return [frame("consumer.left", s, { dur: 600, consumer: id })];
};

const setStatus = (state: KafkaState, id: string, status: Consumer["status"]): KafkaState => ({
  ...state,
  consumers: state.consumers.map((c) => (c.id === id ? { ...c, status, missed: 0 } : c)),
});

// Pausing a client stops fetching, but it keeps heartbeating: it stays in the
// group, keeps its partitions, and nobody else takes them over.
export const pauseConsumer = (state: KafkaState, id: string): KafkaFrame[] => [frame("consumer.paused", setStatus(state, id, "paused"), { dur: 350, consumer: id })];
export const resumeConsumer = (state: KafkaState, id: string): KafkaFrame[] => [frame("consumer.resumed", setStatus(state, id, "running"), { dur: 350, consumer: id })];
export const crashConsumer = (state: KafkaState, id: string): KafkaFrame[] => [frame("consumer.crashed", setStatus(state, id, "crashed"), { dur: 600, consumer: id })];

// Move a partition's progress, as `kafka-consumer-groups --reset-offsets` or
// `seek()` would. Records stay where they are: reading never removes them.
export const seek = (state: KafkaState, index: number, offset: number): KafkaFrame[] => {
  const p = state.partitions[index] as Partition;
  const to = Math.max(0, Math.min(p.records.length, offset));
  const s = setPartition(state, index, { position: to, committed: to, batchEnd: to });
  return [frame("offset.reset", s, { dur: 450, partition: index, offset: to })];
};

// Partitions can be added to a live topic but never removed. New partitions
// change where keys hash to, which is the part people get caught by.
export const addPartition = (state: KafkaState): KafkaFrame[] => {
  if (state.partitions.length >= MAX_PARTITIONS) return [];
  const s = startRebalance({ ...state, partitions: [...state.partitions, blankPartition()] });
  return [frame("partition.added", s, { dur: 600, count: s.partitions.length })];
};

export const configure = (state: KafkaState, patch: KafkaConfig): KafkaFrame[] => [frame("config.changed", { ...state, ...patch }, { dur: 1 })];

export const lastState = (frames: KafkaFrame[], fallback: KafkaState) => frames[frames.length - 1]?.state ?? fallback;

// Tick until the group has nothing left to do; used by the challenge and tests.
export const drain = (state: KafkaState, limit = 500) => {
  let s = state;
  for (let i = 0; i < limit; i++) {
    const out = tick(s);
    if (!out) break;
    s = lastState(out, s);
  }
  return s;
};

export const ticks = (state: KafkaState, count: number) => {
  let s = state;
  for (let i = 0; i < count; i++) {
    const out = tick(s);
    if (!out) break;
    s = lastState(out, s);
  }
  return s;
};

export const repeat = (state: KafkaState, action: (s: KafkaState) => KafkaFrame[], count: number) => {
  let s = state;
  for (let i = 0; i < count; i++) s = lastState(action(s), s);
  return s;
};
