"use client";

import type { Timeline } from "@/lib/simulation/timeline";
import type { SimFrame } from "@/lib/simulation/simulation-types";
import { useTimelineFrame } from "@/lib/simulation/useTimeline";

const ICONS = {
  restart: "M5 4v16M19 5 8 12l11 7z",
  back: "M18 5 8 12l10 7zM6 5v14",
  play: "M7 4v16l13-8z",
  pause: "M7 4h4v16H7zM14 4h4v16h-4z",
  forward: "M6 5l10 7-10 7zM18 5v14",
};
const Icon = ({ name }: { name: keyof typeof ICONS }) => (
  <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d={ICONS[name]} /></svg>
);
const SPEEDS = [0.5, 1, 2];

type Props<F extends SimFrame<unknown>> = {
  timeline: Timeline<F>;
  label: (timeline: Timeline<F>) => string;
  onRestart?: () => void;
};

export const SimulationControls = <F extends SimFrame<unknown>>({ timeline, label, onRestart }: Props<F>) => {
  useTimelineFrame(timeline);
  const playing = timeline.running && !timeline.stepping;
  return (
    <div className="transport" role="group" aria-label="Simulation controls">
      <button type="button" className="tbtn" aria-label="Replay the last action" disabled={timeline.frames.length < 2} onClick={() => (onRestart ? onRestart() : timeline.restart())}><Icon name="restart" /></button>
      <button type="button" className="tbtn" aria-label="Step back" disabled={timeline.atStart} onClick={() => timeline.stepBack()}><Icon name="back" /></button>
      <button type="button" className="tbtn tbtn--main" aria-label={playing ? "Pause" : "Play"} onClick={() => timeline.toggle()}><Icon name={playing ? "pause" : "play"} /></button>
      <button type="button" className="tbtn" aria-label="Step forward" onClick={() => timeline.stepForward()}><Icon name="forward" /></button>
      <span className="transport__pos" data-testid="position">{label(timeline)}</span>
      <span className="transport__speed" role="group" aria-label="Playback speed">
        {SPEEDS.map((s) => (
          <button key={s} type="button" className="tspeed" aria-pressed={timeline.speed === s} onClick={() => timeline.setSpeed(s)}>{s}×</button>
        ))}
      </span>
    </div>
  );
};
