// Kafka's words, kept apart from its logic.
import { lag, SESSION_TIMEOUT_TICKS } from "./sim.js";

const NOTES = {
  "record.produced": (f) => [`${f.record.id} appended`, `Written to partition ${f.record.partition} at offset ${f.record.offset}. ${f.state.keyed ? `Key ${f.record.key} always maps to this partition while the count stays the same.` : "No key, so the producer just spreads records around."}`],
  "consumers.tick": (f) => {
    const n = f.packets.length;
    const commits = (f.notes || []).filter((x) => x.type === "offset.committed");
    const text = commits.length
      ? `Committed: ${commits.map((c) => `P${c.partition} → ${c.offset}${c.early ? " (before processing)" : ""}`).join(", ")}.`
      : "Reading moves a cursor. It doesn't remove anything from the log.";
    return [`${n} record${n === 1 ? "" : "s"} processed in parallel`, text];
  },
  "consumer.joined": (f) => [`${f.consumer} joins the group`, "A new member triggers a rebalance, so every partition's ownership gets worked out again."],
  "consumer.left": (f) => [`${f.consumer} leaves cleanly`, "It commits what it finished, then tells the group, so the rebalance starts straight away."],
  "consumer.paused": (f) => [`${f.consumer} paused`, "It stops fetching but keeps heartbeating. It stays in the group and keeps its partitions, so their lag grows."],
  "consumer.resumed": (f) => [`${f.consumer} resumed`, "It carries on from its position."],
  "consumer.crashed": (f) => [`${f.consumer} crashed`, `Heartbeats stop, but nobody knows yet. The group waits for the session timeout (${SESSION_TIMEOUT_TICKS} ticks here) and its partitions sit unread.`],
  "session.expired": (f) => [`${f.gone.join(", ")} timed out`, "The coordinator declares it dead and starts a rebalance."],
  "rebalance.running": () => ["Rebalancing", "Nothing is consumed while ownership is being reassigned."],
  "rebalance.done": (f) => [`Generation ${f.state.generation}`, "New owners resume from the last committed offset, not from where the old owner had reached."],
  "offset.reset": (f) => [`P${f.partition} reset to offset ${f.offset}`, "The records are still there, so they can simply be read again. Replay is a feature of a log."],
  "partition.added": (f) => [`Topic now has ${f.count} partitions`, "You can add partitions but never remove them. Keys can now hash somewhere new, so a key's old and new records may sit in different partitions."],
  "config.changed": () => ["Settings changed", "Applies from the next record or poll."],
};

export const describe = (frame) => {
  const note = NOTES[frame.type];
  return note ? note(frame) : ["Ready", "Send records and watch them land."];
};

// `kafka-consumer-groups --describe`, from live simulation state.
export const cliTable = (s) => {
  const pad = (v, n) => String(v).padEnd(n);
  const head = `${pad("PARTITION", 11)}${pad("CURRENT-OFFSET", 16)}${pad("LOG-END-OFFSET", 16)}${pad("LAG", 6)}CONSUMER-ID`;
  const rows = s.partitions.map((p, i) => `${pad(i, 11)}${pad(p.committed, 16)}${pad(p.records.length, 16)}${pad(lag(p), 6)}${p.owner || "-"}`);
  return { head, rows };
};

// Guided experiments. `build` makes the opening state, `play` is what you watch.
export const EXPERIMENTS = {
  ordering: {
    label: "1", title: "Ordering",
    lesson: "Keyed records stay in order, because one key means one partition. Turn “Use keys” off and send more: watch the sink flag records that overtake each other.",
    options: { partitions: 3, consumers: 3 }, records: 9,
  },
  scale: {
    label: "2", title: "Parallelism",
    lesson: "Two partitions, five consumers. Three sit idle: each partition has one owner per group. Add a partition to put another consumer to work.",
    options: { partitions: 2, consumers: 5 }, records: 12,
  },
  lag: {
    label: "3", title: "Lag",
    lesson: "One consumer is paused. It keeps its partitions, so nobody picks up the slack and lag climbs. Resume it and watch the gap close.",
    options: { partitions: 3, consumers: 2 }, records: 15, pause: "c1",
  },
  crash: {
    label: "4", title: "Crash",
    lesson: "A consumer dies mid-batch, before committing. After the timeout its successor starts from the last commit, so some records are processed twice. Dashed cells in the sink are duplicates.",
    options: { partitions: 2, consumers: 2, commitEvery: 5 }, records: 16, ticks: 3, crash: "c1",
  },
  replay: {
    label: "5", title: "Replay",
    lesson: "Everything has been read, and it's all still on the tape. Click any record to rewind that partition and process it again. A database row wouldn't let you do that.",
    options: { partitions: 2, consumers: 2 }, records: 10, drain: true,
  },
};
