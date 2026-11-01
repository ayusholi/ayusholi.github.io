"use client";

import { useCallback, useRef, useState } from "react";
import { Caption } from "@/components/simulation/Caption";
import { ComponentInspector } from "@/components/simulation/ComponentInspector";
import { LatencyStrips } from "./LatencyStrips";
import { paced } from "./RedisProvider";
import { RedisSchematic } from "./RedisSchematic";
import { describe, ROLES } from "./redis-content";
import * as engine from "./redis-engine";
import { readyFrame } from "./redis-scenarios";
import type { RedisAction, RedisFrame, RedisNodeId } from "./redis-types";
import { useFirstSight, usePauseWhenHidden, useTimeline, useTimelineFrame } from "@/lib/simulation/useTimeline";

// The homepage opening: the real Redis engine, with Nginx in front.
const KEY = "user:42";
const fast = (frames: RedisFrame[]) => frames.map((f) => ({ ...f, dur: f.dur * 0.55 }));

export const RedisHero = () => {
  const timeline = useTimeline<RedisFrame>(() => ({ initial: readyFrame(engine.createState({ edge: true, ttl: 30 })) }));
  const frame = useTimelineFrame(timeline);
  const [selected, setSelected] = useState<RedisNodeId | null>(null);
  const root = useRef<HTMLDivElement>(null);
  usePauseWhenHidden(root, timeline);

  // Show first: one miss then one hit, once, as soon as it's visible.
  useFirstSight(root, useCallback(() => {
    const { frames } = engine.run(timeline.present, (s) => engine.get(s, KEY), (s) => engine.get(s, KEY));
    timeline.push(fast(paced(frames, 1000)));
  }, [timeline]));

  const act = (action: RedisAction) => {
    const frames = action(timeline.present);
    if (frames?.length) timeline.push(paced(frames, 1000));
  };
  const [title, text] = describe(frame);

  return (
    <div className="bench--home sheet" id="hero" ref={root} role="region" aria-label="A live request travelling through a small web application">
      <div className="hero-grid">
        <div>
          <div id="hero-stage"><RedisSchematic timeline={timeline} frame={frame} edge selected={selected} onSelect={setSelected} /></div>
          <Caption id="hero-caption" title={title} text={text} />
        </div>
        <div className="hero-side">
          <div className="hero-side__actions">
            <button type="button" className="btn btn--solid btn--wide" id="hero-send" onClick={() => act((s) => engine.get(s, KEY))}>Send a request</button>
            <button type="button" className="btn btn--wide" id="hero-wait" onClick={() => act((s) => engine.advanceClock(s, 31))}>Wait 31 s (TTL is 30 s)</button>
            <button type="button" className="btn btn--wide" id="hero-clear" disabled={!Object.keys(timeline.present.cache).length} onClick={() => act(engine.flush)}>Clear the cache</button>
          </div>
          <div id="hero-inspect" className="flex-1">
            <ComponentInspector
              item={selected && ROLES[selected]}
              idle={<><p className="label">Try this</p><p>Same request, different path. Click any component to see what it does.</p></>}
            />
          </div>
          <div>
            <div className="readout__h label"><span>Each request, to scale</span></div>
            <LatencyStrips id="hero-strips" state={frame.state} limit={4} />
          </div>
        </div>
      </div>
      <div className="titleblock label">
        <span><b>Sheet 00</b> · A request, end to end</span>
        <span>A running simulation, not a recording</span>
        <span>Timings illustrative</span>
      </div>
    </div>
  );
};
