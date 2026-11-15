"use client";

import type { Dispatch } from "react";
import { Glyph } from "./Glyph";
import { useOs } from "./OsContext";
import { APPS, focusedWindow } from "./os-engine";
import type { AppId, OsAction } from "./os-types";

const ITEMS: { id: AppId; name: string; label: string; key?: string }[] = [
  ...APPS,
  { id: "terminal", name: "TERMINAL", label: "Shell", key: "`" },
];

// The dock: every app, which ones are running, and which has focus.
// Clicking the focused app minimises it, as on a desktop OS.
export function Dock({ dispatch }: { dispatch: Dispatch<OsAction> }) {
  const { state, open, compact, home } = useOs();
  const top = focusedWindow(state);
  return (
    <nav className="dock" aria-label="Dock">
      <button type="button" className="dock__btn dock__home" onClick={home} aria-label="Show desktop" data-focused={!top || undefined}>
        <Glyph app="home" size={18} /><span className="dock__label">Home</span>
      </button>
      <span className="dock__sep" aria-hidden="true" />
      {ITEMS.map((a) => {
        const w = state.windows.find((x) => x.app === a.id);
        const focused = top?.app === a.id;
        return (
          <button key={a.id} id={`dock-${a.id}`} type="button" className="dock__btn" data-open={w ? true : undefined} data-focused={focused || undefined}
            aria-label={`${a.name}${w ? (focused ? ", focused" : ", open") : ""}`} aria-keyshortcuts={a.key} title={`${a.name}${a.key ? ` (${a.key})` : ""}`}
            onClick={() => (focused && !compact ? dispatch({ type: "minimize", app: a.id }) : open(a.id))}>
            <Glyph app={a.id} size={18} />
            <span className="dock__label">{a.label}</span>
            <span className="dock__run" aria-hidden="true" />
          </button>
        );
      })}
    </nav>
  );
}
