"use client";

import type { RefObject } from "react";

const DIRS: { id: string; label: string; v: [number, number] }[] = [
  { id: "up", label: "Up", v: [0, -1] },
  { id: "left", label: "Left", v: [-1, 0] },
  { id: "right", label: "Right", v: [1, 0] },
  { id: "down", label: "Down", v: [0, 1] },
];

/** A compact d-pad and an interact button for touch screens. Only the pad captures touches. */
export function MobileControls({ padRef, onAct }: { padRef: RefObject<[number, number]>; onAct: () => void }) {
  const press = (v: [number, number]) => (e: React.PointerEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    padRef.current = v;
    e.currentTarget.dataset.down = "true";
  };
  const release = (e: React.PointerEvent<HTMLButtonElement>) => {
    padRef.current = [0, 0];
    delete e.currentTarget.dataset.down;
  };
  return (
    <div className="wpad" aria-hidden="true">
      <div className="wpad__dirs">
        {DIRS.map((d) => (
          <button key={d.id} type="button" tabIndex={-1} className={`wpad__btn wpad__btn--${d.id}`} aria-label={d.label}
            onPointerDown={press(d.v)} onPointerUp={release} onPointerCancel={release} onLostPointerCapture={release}
            onContextMenu={(e) => e.preventDefault()}>
            <svg viewBox="0 0 10 10" aria-hidden="true"><path d="M5 2 L8.5 7 H1.5 Z" /></svg>
          </button>
        ))}
      </div>
      <button type="button" tabIndex={-1} className="wpad__act" aria-label="Interact"
        onPointerDown={(e) => { e.preventDefault(); onAct(); }} onContextMenu={(e) => e.preventDefault()}>E</button>
    </div>
  );
}
