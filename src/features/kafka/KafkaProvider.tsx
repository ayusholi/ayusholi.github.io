"use client";

import { createContext, use, useCallback, useRef, useState, type ReactNode } from "react";
import { useTimeline } from "@/lib/simulation/useTimeline";
import type { Timeline } from "@/lib/simulation/timeline";
import * as engine from "./kafka-engine";
import { buildExperiment, EXPERIMENTS, readyFrame, type ExperimentId } from "./kafka-scenarios";
import type { KafkaFrame, KafkaState } from "./kafka-types";

type KafkaBench = {
  timeline: Timeline<KafkaFrame>;
  experiment: ExperimentId | null;
  lesson: string;
  auto: boolean;
  setAuto: (on: boolean) => void;
  act: (action: (s: KafkaState) => KafkaFrame[]) => void;
  runExperiment: (id: ExperimentId) => void;
  freshTopic: (partitions: number) => void;
};

const Context = createContext<KafkaBench | null>(null);

export const useKafka = () => {
  const value = use(Context);
  if (!value) throw new Error("useKafka needs a KafkaProvider");
  return value;
};

// One simulation, read by panels spread through a server-rendered article.
export const KafkaProvider = ({ children }: { children: ReactNode }) => {
  // Keep-sending is a visitor setting, not part of the topic's state.
  const producer = useRef({ auto: false, beat: 0 });
  const timeline = useTimeline<KafkaFrame>(() => ({
    initial: readyFrame(engine.createState()),
    generate: (state) => (producer.current.auto && producer.current.beat++ % 2 === 0 ? engine.produce(state) : engine.tick(state)),
  }));
  const [experiment, setExperiment] = useState<ExperimentId | null>("ordering");
  const [lesson, setLesson] = useState(EXPERIMENTS.ordering.lesson);
  const [auto, setAutoState] = useState(false);

  const setAuto = useCallback((on: boolean) => {
    producer.current.auto = on;
    setAutoState(on);
    if (on) timeline.play();
  }, [timeline]);

  // Every action applies to the present, and goes on screen at once when paused.
  const act = useCallback((action: (s: KafkaState) => KafkaFrame[]) => {
    const frames = action(timeline.present);
    if (frames.length) timeline.push(frames, { animate: timeline.running, restart: false });
  }, [timeline]);

  const load = useCallback((state: KafkaState) => {
    setAuto(false);
    timeline.reset(readyFrame(state));
    timeline.play();
  }, [setAuto, timeline]);

  const runExperiment = useCallback((id: ExperimentId) => {
    setExperiment(id);
    setLesson(EXPERIMENTS[id].lesson);
    load(buildExperiment(id));
  }, [load]);

  const freshTopic = useCallback((partitions: number) => {
    setExperiment(null);
    setLesson(`A new topic with ${partitions} partition${partitions === 1 ? "" : "s"}. A live topic can't shrink, so going down means starting again.`);
    load(engine.createState({ partitions, consumers: 2 }));
  }, [load]);

  return <Context value={{ timeline, experiment, lesson, auto, setAuto, act, runExperiment, freshTopic }}>{children}</Context>;
};
