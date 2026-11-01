import type { SimFrame } from "@/lib/simulation/simulation-types";

export type RecordKey = "A" | "B" | "C";
export type ConsumerStatus = "running" | "paused" | "crashed";
export type CommitMode = "after" | "before";

export type KafkaRecord = { id: string; key: RecordKey; seq: number; offset: number; partition: number };

export type Partition = {
  records: KafkaRecord[];
  position: number;       // next offset the owner will read
  committed: number;      // what the group has stored as done
  batchEnd: number;       // end of the batch from the last poll
  owner: string | null;
};

export type Consumer = { id: string; status: ConsumerStatus; missed: number; cursor: number };

export type AppliedRecord = {
  id: string; key: RecordKey; partition: number; offset: number; consumer: string;
  duplicate: boolean; skipped: boolean; outOfOrder: boolean;
};

export type KafkaStats = { delivered: number; duplicates: number; lost: number; outOfOrder: number };

export type KafkaState = {
  partitions: Partition[];
  consumers: Consumer[];
  nextConsumer: number;
  generation: number;
  rebalancing: number;    // ticks of stop-the-world left
  commitEvery: number;    // records per poll, then commit
  commitMode: CommitMode; // "after" is at-least-once, "before" is at-most-once
  idempotent: boolean;    // the application ignores records it has already applied
  keyed: boolean;
  tick: number;
  produced: number;
  robin: number;
  sequence: Record<RecordKey, number>;
  applied: AppliedRecord[];
  counts: Record<string, number>;
  lastByKey: Partial<Record<RecordKey, number>>;
  stats: KafkaStats;
};

export type KafkaConfig = Partial<Pick<KafkaState, "commitEvery" | "commitMode" | "idempotent" | "keyed">>;

export type KafkaOptions = KafkaConfig & {
  partitions?: number;
  consumers?: number;
};

export type KafkaPacket =
  | { kind: "produce"; record: KafkaRecord; partition: number }
  | { kind: "consume"; record: KafkaRecord; partition: number; consumer: string; duplicate: boolean };

export type CommitNote = { partition: number; offset: number; consumer: string; early?: boolean };

export type KafkaEventType =
  | "ready" | "record.produced" | "consumers.tick"
  | "consumer.joined" | "consumer.left" | "consumer.paused" | "consumer.resumed" | "consumer.crashed"
  | "session.expired" | "rebalance.running" | "rebalance.done"
  | "offset.reset" | "partition.added" | "config.changed";

export type KafkaFrame = SimFrame<KafkaState> & {
  type: KafkaEventType;
  packets: KafkaPacket[];
  record?: KafkaRecord;
  consumer?: string;
  gone?: string[];
  commits?: CommitNote[];
  partition?: number;
  offset?: number;
  count?: number;
};
