"use client";

import { createContext, use, useCallback, useState, type ReactNode } from "react";
import { reducedMotion, useTimeline } from "@/lib/simulation/useTimeline";
import type { Timeline } from "@/lib/simulation/timeline";
import * as engine from "./redis-engine";
import { buildScenario, readyFrame, SCENARIOS, type ScenarioId } from "./redis-scenarios";
import type { RedisAction, RedisConfig, RedisFrame } from "./redis-types";

// Slower pacing without travel, so each stop can be read.
export const paced = (frames: RedisFrame[], min = 1100) =>
  reducedMotion() ? frames.map((f) => ({ ...f, dur: Math.max(f.dur, min) })) : frames;

type RedisBench = {
  timeline: Timeline<RedisFrame>;
  scenario: ScenarioId | null;
  lesson: string;
  act: (action: RedisAction) => void;
  configure: (patch: RedisConfig) => void;
  runScenario: (id: ScenarioId) => void;
  reset: () => void;
};

const Context = createContext<RedisBench | null>(null);

export const useRedis = () => {
  const value = use(Context);
  if (!value) throw new Error("useRedis needs a RedisProvider");
  return value;
};

// One simulation, read by panels spread through a server-rendered article.
export const RedisProvider = ({ children }: { children: ReactNode }) => {
  const timeline = useTimeline<RedisFrame>(() => ({ initial: readyFrame(engine.createState()) }));
  const [scenario, setScenario] = useState<ScenarioId | null>("miss");
  const [lesson, setLesson] = useState(SCENARIOS.miss.lesson);

  const act = useCallback((action: RedisAction) => {
    const frames = action(timeline.present);
    if (frames?.length) timeline.push(paced(frames));
  }, [timeline]);

  const configure = useCallback((patch: RedisConfig) => {
    timeline.push(engine.configure(timeline.present, patch), { animate: false, restart: false });
  }, [timeline]);

  const runScenario = useCallback((id: ScenarioId) => {
    const { state, frames } = buildScenario(id);
    setScenario(id);
    setLesson(SCENARIOS[id].lesson);
    timeline.reset(readyFrame(state));
    timeline.push(paced(frames));
  }, [timeline]);

  const reset = useCallback(() => {
    setScenario(null);
    setLesson("Clean slate. Send a request, or pick a scenario above.");
    timeline.reset(readyFrame(engine.createState()));
  }, [timeline]);

  return <Context value={{ timeline, scenario, lesson, act, configure, runScenario, reset }}>{children}</Context>;
};
