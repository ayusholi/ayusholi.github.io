import * as engine from "./kafka-engine";
import type { KafkaFrame, KafkaOptions, KafkaState } from "./kafka-types";

type Experiment = {
  label: string;
  title: string;
  lesson: string;
  options: KafkaOptions;
  records: number;
  pause?: string;
  ticks?: number;
  crash?: string;
  drain?: boolean;
};

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
} satisfies Record<string, Experiment>;

export type ExperimentId = keyof typeof EXPERIMENTS;

export const readyFrame = (state: KafkaState): KafkaFrame => ({ type: "ready", state, packets: [], dur: 1 });

export const buildExperiment = (id: ExperimentId) => {
  const x: Experiment = EXPERIMENTS[id];
  let s = engine.createState(x.options);
  if (x.pause) s = engine.lastState(engine.pauseConsumer(s, x.pause), s);
  s = engine.repeat(s, engine.produce, x.records);
  if (x.ticks) s = engine.ticks(s, x.ticks);
  if (x.crash) {
    // Crash whichever consumer is really mid-batch, so the lesson always shows.
    const target = s.partitions.find((p) => p.position > p.committed && p.owner)?.owner ?? x.crash;
    s = engine.lastState(engine.crashConsumer(s, target), s);
  }
  if (x.drain) s = engine.drain(s);
  return s;
};
