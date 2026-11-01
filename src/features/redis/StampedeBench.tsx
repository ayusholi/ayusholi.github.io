"use client";

import { useRef, useState } from "react";
import { Caption } from "@/components/simulation/Caption";
import { Segmented } from "@/components/ui/Segmented";
import { usePauseWhenHidden, useTimeline, useTimelineFrame } from "@/lib/simulation/useTimeline";
import { paced } from "./RedisProvider";
import { RedisSchematic } from "./RedisSchematic";
import { describe } from "./redis-content";
import { createState, stampede } from "./redis-engine";
import { readyFrame } from "./redis-scenarios";
import type { RedisFrame, RedisNodeId } from "./redis-types";

// A second, smaller bench on the same engine.
export const StampedeBench = () => {
  const timeline = useTimeline<RedisFrame>(() => ({ initial: readyFrame(createState()) }));
  const frame = useTimelineFrame(timeline);
  const [mode, setMode] = useState<"open" | "lock">("open");
  const [selected, setSelected] = useState<RedisNodeId | null>(null);
  const root = useRef<HTMLDivElement>(null);
  usePauseWhenHidden(root, timeline);
  const [title, text] = describe(frame);

  const send = () => {
    const state = createState();
    timeline.reset(readyFrame(state));
    timeline.push(paced(stampede(state, "user:42", 8, mode === "lock") ?? []));
  };

  return (
    <div className="sheet" id="crowd" ref={root}>
      <RedisSchematic timeline={timeline} frame={frame} selected={selected} onSelect={setSelected} />
      <Caption title={title} text={text} />
      <div className="transport-bar control__row">
        <Segmented id="crowd-mode" label="Protection" value={mode} options={[["open", "No protection"], ["lock", "Single-flight lock"]]} onChange={setMode} />
        <button type="button" className="btn btn--solid" id="crowd-run" onClick={send}>Send 8 requests at a cold key</button>
      </div>
    </div>
  );
};
