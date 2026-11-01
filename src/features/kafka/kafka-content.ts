// Kafka's words, kept apart from its logic.
import { lag, SESSION_TIMEOUT_TICKS } from "./kafka-engine";
import type { KafkaEventType, KafkaFrame, KafkaState } from "./kafka-types";

type Note = [title: string, text: string];

const NOTES: Record<KafkaEventType, (f: KafkaFrame) => Note> = {
  ready: () => ["Ready", "Send records and watch them land."],
  "record.produced": (f) => [`${f.record?.id} appended`, `Written to partition ${f.record?.partition} at offset ${f.record?.offset}. ${f.state.keyed ? `Key ${f.record?.key} always maps to this partition while the count stays the same.` : "No key, so the producer just spreads records around."}`],
  "consumers.tick": (f) => {
    const n = f.packets.length;
    const commits = f.commits ?? [];
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
  "session.expired": (f) => [`${f.gone?.join(", ")} timed out`, "The coordinator declares it dead and starts a rebalance."],
  "rebalance.running": () => ["Rebalancing", "Nothing is consumed while ownership is being reassigned."],
  "rebalance.done": (f) => [`Generation ${f.state.generation}`, "New owners resume from the last committed offset, not from where the old owner had reached."],
  "offset.reset": (f) => [`P${f.partition} reset to offset ${f.offset}`, "The records are still there, so they can simply be read again. Replay is a feature of a log."],
  "partition.added": (f) => [`Topic now has ${f.count} partitions`, "You can add partitions but never remove them. Keys can now hash somewhere new, so a key's old and new records may sit in different partitions."],
  "config.changed": () => ["Settings changed", "Applies from the next record or poll."],
};

export const describe = (frame: KafkaFrame): Note => NOTES[frame.type](frame);

// `kafka-consumer-groups --describe`, from live simulation state.
export const cliTable = (s: KafkaState) => {
  const pad = (v: string | number, n: number) => String(v).padEnd(n);
  const head = `${pad("PARTITION", 11)}${pad("CURRENT-OFFSET", 16)}${pad("LOG-END-OFFSET", 16)}${pad("LAG", 6)}CONSUMER-ID`;
  const rows = s.partitions.map((p, i) => `${pad(i, 11)}${pad(p.committed, 16)}${pad(p.records.length, 16)}${pad(lag(p), 6)}${p.owner || "-"}`);
  return { head, rows };
};
