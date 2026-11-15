"use client";

import { m } from "motion/react";
import { useRef, type Dispatch, type ReactNode, type RefObject } from "react";
import { Glyph } from "./Glyph";
import { useOs } from "./OsContext";
import { appName } from "./os-engine";
import type { OsAction, Win } from "./os-types";

type Props = {
  win: Win;
  focused: boolean;
  boundsRef: RefObject<HTMLElement | null>;
  dispatch: Dispatch<OsAction>;
  children: ReactNode;
};

// A movable app window. On desktop it drags by its title bar and can be
// maximised; in compact mode it always fills the screen.
export function Window({ win, focused, boundsRef, dispatch, children }: Props) {
  const { compact, close, state } = useOs();
  const drag = useRef<{ px: number; py: number; x: number; y: number } | null>(null);
  const selfRef = useRef<HTMLElement>(null);
  const titleId = `win-${win.app}-title`;
  const selected = state.selection[win.app];
  const full = compact || win.maximized;

  const onDown = (e: React.PointerEvent) => {
    if (full || e.button !== 0 || (e.target as HTMLElement).closest("button")) return;
    drag.current = { px: e.clientX, py: e.clientY, x: win.x, y: win.y };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onMove = (e: React.PointerEvent) => {
    const d = drag.current, bounds = boundsRef.current, self = selfRef.current;
    if (!d || !bounds || !self) return;
    const B = bounds.getBoundingClientRect(), W = self.offsetWidth;
    const x = Math.min(Math.max(d.x + e.clientX - d.px, 140 - W), B.width - 140);
    const y = Math.min(Math.max(d.y + e.clientY - d.py, 0), B.height - 44);
    dispatch({ type: "move", app: win.app, x: Math.round(x), y: Math.round(y) });
  };
  const onUp = () => { drag.current = null; };

  return (
    <m.section
      ref={selfRef}
      id={`win-${win.app}`}
      className="win"
      data-app={win.app}
      data-focused={focused || undefined}
      data-full={full || undefined}
      aria-labelledby={titleId}
      tabIndex={-1}
      style={{ "--x": `${win.x}px`, "--y": `${win.y}px`, zIndex: win.z } as React.CSSProperties}
      initial={{ opacity: 0, scale: 0.985, y: 10 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.985, y: 6, transition: { duration: 0.14 } }}
      transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
      onPointerDownCapture={() => { if (!focused) dispatch({ type: "focus", app: win.app }); }}
    >
      <header className="win__bar" onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}
        onDoubleClick={(e) => { if (!compact && !(e.target as HTMLElement).closest("button")) dispatch({ type: "toggleMax", app: win.app }); }}>
        {compact && (
          <button type="button" className="win__back" onClick={() => dispatch({ type: "minimize", app: win.app })} aria-label="Back to desktop">
            <span aria-hidden="true">←</span>
          </button>
        )}
        <span className="win__icon"><Glyph app={win.app} size={15} /></span>
        <h2 className="win__title" id={titleId}>
          {appName(win.app)}
          {selected && <span className="win__crumb"> / {selected}</span>}
        </h2>
        <div className="win__ctrls">
          {!compact && (
            <>
              <button type="button" className="win__btn" onClick={() => dispatch({ type: "minimize", app: win.app })} aria-label={`Minimise ${appName(win.app)}`} title="Minimise">
                <svg viewBox="0 0 12 12" aria-hidden="true"><path d="M2.5 8.5h7" /></svg>
              </button>
              <button type="button" className="win__btn" onClick={() => dispatch({ type: "toggleMax", app: win.app })} aria-label={win.maximized ? "Restore size" : "Maximise"} aria-pressed={win.maximized} title={win.maximized ? "Restore" : "Maximise"}>
                <svg viewBox="0 0 12 12" aria-hidden="true">{win.maximized ? <path d="M4 2.5h5.5V8M2.5 4h5.5v5.5H2.5z" /> : <path d="M2.5 2.5h7v7h-7z" />}</svg>
              </button>
            </>
          )}
          <button type="button" className="win__btn win__btn--close" onClick={() => close(win.app)} aria-label={`Close ${appName(win.app)}`} title="Close (Esc)">
            <svg viewBox="0 0 12 12" aria-hidden="true"><path d="M3 3l6 6M9 3l-6 6" /></svg>
          </button>
        </div>
      </header>
      <div className="win__body">{children}</div>
    </m.section>
  );
}
