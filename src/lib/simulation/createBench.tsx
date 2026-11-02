"use client";

import { createContext, use, useCallback, useState, type ReactNode } from "react";
import type { Timeline } from "./timeline";
import type { SimFrame } from "./simulation-types";
import { reducedMotion, useTimeline } from "./useTimeline";

// The provider every scenario-driven topic shares: one timeline, a set of
// guided scenarios, and actions that always apply to the present state.
// Kafka and Redis predate it and keep their own.

export type BenchScenario = { label: string; title: string; lesson: string };

type Options<S, F extends SimFrame<S>, Id extends string> = {
  name: string;
  initial: () => S;
  ready: (state: S) => F;
  scenarios: Record<Id, BenchScenario>;
  first: NoInfer<Id>;
  build: (id: NoInfer<Id>) => { state: S; frames: F[] };
  // For systems that carry on by themselves, like a control loop.
  generate?: (state: S) => F[] | null;
  resetLesson: string;
};

export type Bench<S, F extends SimFrame<S>, Id extends string> = {
  timeline: Timeline<F>;
  scenario: Id | null;
  lesson: string;
  act: (action: (state: S) => F[] | null) => void;
  runScenario: (id: Id) => void;
  reset: () => void;
};

// Slower pacing without travel, so each stop can be read.
const paced = <F extends SimFrame<unknown>>(frames: F[], min = 1100) =>
  reducedMotion() ? frames.map((f) => ({ ...f, dur: Math.max(f.dur, min) })) : frames;

export const createBench = <S, F extends SimFrame<S>, Id extends string>(o: Options<S, F, Id>) => {
  const Context = createContext<Bench<S, F, Id> | null>(null);

  const useBench = () => {
    const value = use(Context);
    if (!value) throw new Error(`use${o.name} needs a ${o.name}Provider`);
    return value;
  };

  // One simulation, read by panels spread through a server-rendered article.
  const Provider = ({ children }: { children: ReactNode }) => {
    const timeline = useTimeline<F>(() => ({ initial: o.ready(o.initial()), generate: o.generate as ((s: unknown) => F[] | null) | undefined }));
    const [scenario, setScenario] = useState<Id | null>(o.first);
    const [lesson, setLesson] = useState(o.scenarios[o.first].lesson);

    const act = useCallback((action: (state: S) => F[] | null) => {
      const frames = action(timeline.present as S);
      if (frames?.length) timeline.push(paced(frames));
    }, [timeline]);

    const runScenario = useCallback((id: Id) => {
      const { state, frames } = o.build(id);
      setScenario(id);
      setLesson(o.scenarios[id].lesson);
      timeline.reset(o.ready(state));
      if (frames.length) timeline.push(paced(frames));
      else if (o.generate) timeline.play();
    }, [timeline]);

    const reset = useCallback(() => {
      setScenario(null);
      setLesson(o.resetLesson);
      timeline.reset(o.ready(o.initial()));
    }, [timeline]);

    return <Context value={{ timeline, scenario, lesson, act, runScenario, reset }}>{children}</Context>;
  };

  return { Provider, useBench };
};
