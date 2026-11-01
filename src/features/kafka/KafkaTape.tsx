"use client";

import { memo, useEffect, useRef, useState } from "react";
import { lag } from "./kafka-engine";
import type { Partition } from "./kafka-types";

export const CELL = 40;   // record width plus gap, in px
export const cellX = (offset: number) => offset * CELL + 2;

type Props = { partition: Partition; index: number; incoming: number | null; onSeek: (partition: number, offset: number) => void };

// One partition, drawn as a tape. Cells are keyed by offset, and the view
// scrolls to keep the log end in sight.
export const KafkaTape = memo(function KafkaTape({ partition: p, index, incoming, onSeek }: Props) {
  const track = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = track.current;
    if (!el) return;
    const observer = new ResizeObserver(() => setWidth(el.clientWidth));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const visible = Math.max(3, Math.floor(width / CELL));
  const start = Math.max(0, p.records.length + 1 - visible);
  const behind = start - p.position;   // the cursor can fall off the left of the tape
  const n = lag(p);

  return (
    <div className={`tape${p.owner ? "" : " is-orphan"}`}>
      <span className="tape__name">P{index}</span>
      <div className="tape__track" data-p={index} data-start={start} ref={track}>
        <div className="tape__strip" style={{ transform: `translateX(${-start * CELL}px)` }}>
          <span className="commit-mark" style={{ transform: `translateX(${cellX(p.committed) - 2}px)` }} />
          <span className="cursor" style={{ transform: `translateX(${cellX(p.position) - 2}px)` }}><span>{p.owner ?? "–"}</span></span>
          {p.records.map((r) => {
            const state = r.offset < p.committed ? " is-committed" : r.offset < p.position ? " is-read" : "";
            return (
              <button
                key={r.offset}
                type="button"
                tabIndex={-1}   // the seek form is the keyboard route
                className={`rec${state}${incoming === r.offset ? " is-incoming" : ""}`}
                data-offset={r.offset}
                data-record={r.id}
                style={{ left: cellX(r.offset) }}
                title={`Rewind P${index} to offset ${r.offset}`}
                onClick={() => onSeek(index, r.offset)}
              >
                {r.id}<small>{r.offset}</small>
              </button>
            );
          })}
        </div>
        {behind > 0 && <span className="tape__behind">◂ {p.owner ?? "group"} {behind} back</span>}
      </div>
      <span className={`tape__lag${n >= 8 ? " is-high" : ""}`}><b>{n}</b><br />lag</span>
    </div>
  );
});
