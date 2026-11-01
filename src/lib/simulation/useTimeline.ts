"use client";

import { useEffect, useState, useSyncExternalStore, type RefObject } from "react";
import { Timeline, type TimelineOptions } from "./timeline";
import type { SimFrame } from "./simulation-types";

// Owns one Timeline for a component's lifetime. Domain state lives in the
// timeline's frames, so this is the only place a simulation meets React, and
// the animation loop stops with the component.
export const useTimeline = <F extends SimFrame<unknown>>(create: () => TimelineOptions<F>) => {
  const [timeline] = useState(() => new Timeline<F>(create()));
  useEffect(() => () => timeline.dispose(), [timeline]);
  return timeline;
};

// Re-renders the caller when the frame or transport state changes. Never on
// animation progress, which stays outside React.
export const useTimelineFrame = <F extends SimFrame<unknown>>(timeline: Timeline<F>) => {
  useSyncExternalStore(timeline.subscribe, timeline.getVersion, timeline.getVersion);
  return timeline.frame;
};

// A simulation only runs while it can be seen.
export const usePauseWhenHidden = <F extends SimFrame<unknown>>(ref: RefObject<HTMLElement | null>, timeline: Timeline<F>) => {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let onScreen = false;
    const sync = () => timeline.suspend(!onScreen || document.hidden);
    const io = new IntersectionObserver(([entry]) => { onScreen = !!entry?.isIntersecting; sync(); }, { threshold: 0.05 });
    io.observe(el);
    document.addEventListener("visibilitychange", sync);
    sync();
    return () => { io.disconnect(); document.removeEventListener("visibilitychange", sync); };
  }, [ref, timeline]);
};

// Runs once, the first time an element scrolls into view.
export const useFirstSight = (ref: RefObject<HTMLElement | null>, run: () => void, threshold = 0.3) => {
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || seen) return;
    const io = new IntersectionObserver(([entry]) => {
      if (!entry?.isIntersecting) return;
      io.disconnect();
      setSeen(true);
      run();
    }, { threshold });
    io.observe(el);
    return () => io.disconnect();
  }, [ref, run, seen, threshold]);
};

// ← → step, Space plays. Ignored while typing or on a control with its own keys.
export const transportKeys = <F extends SimFrame<unknown>>(timeline: Timeline<F>) => (e: React.KeyboardEvent) => {
  const target = e.target as HTMLElement;
  if (target.closest("input, select, textarea")) return;
  if (e.key === "ArrowRight") { e.preventDefault(); timeline.stepForward(); }
  else if (e.key === "ArrowLeft") { e.preventDefault(); timeline.stepBack(); }
  else if (e.key === " " && !target.closest("button, a, summary")) { e.preventDefault(); timeline.toggle(); }
};

export const reducedMotion = () => globalThis.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
