"use client";

import { AnimatePresence } from "motion/react";
import { useCallback, useEffect, useMemo, useReducer, useRef } from "react";
import { Desktop } from "./Desktop";
import { Dock } from "./Dock";
import { OsContext, type OsApi, useCompact } from "./OsContext";
import { DiscoveryToast, StatusBar } from "./StatusBar";
import { Window } from "./Window";
import { APPS, discoveryFor, focusedWindow, initialState, osReducer, parseHash, toHash } from "./os-engine";
import type { AppId } from "./os-types";
import { CareerApp } from "./apps/CareerApp";
import { FounderApp } from "./apps/FounderApp";
import { LogApp } from "./apps/LogApp";
import { ProjectsApp } from "./apps/ProjectsApp";
import { StackApp } from "./apps/StackApp";
import { TerminalApp } from "./apps/TerminalApp";

const STORE_KEY = "ayush-os:found";
const KONAMI = ["ArrowUp", "ArrowUp", "ArrowDown", "ArrowDown", "ArrowLeft", "ArrowRight", "ArrowLeft", "ArrowRight", "b", "a"];

const APP_VIEWS: Record<AppId, () => React.ReactNode> = {
  career: () => <CareerApp />,
  projects: () => <ProjectsApp />,
  stack: () => <StackApp />,
  log: () => <LogApp />,
  founder: () => <FounderApp />,
  terminal: () => <TerminalApp />,
};

// Moves keyboard focus into an app once it has rendered.
const focusApp = (app: AppId) =>
  requestAnimationFrame(() => {
    const el = document.getElementById(app === "terminal" ? "term-input" : `win-${app}`);
    el?.focus({ preventScroll: true });
  });

const isTyping = (t: EventTarget | null) =>
  t instanceof HTMLElement && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable);

export function OsShell() {
  const [state, dispatch] = useReducer(osReducer, initialState);
  const compact = useCompact();
  const desktopRef = useRef<HTMLDivElement>(null);
  const konami = useRef(0);
  // The key handler reads the latest state without re-subscribing every render.
  const stateRef = useRef(state);
  useEffect(() => { stateRef.current = state; }, [state]);

  const discover = useCallback((id: string) => dispatch({ type: "discover", id }), []);

  const open = useCallback((app: AppId, select?: string) => {
    dispatch({ type: "open", app, select });
    const d = discoveryFor(app, select);
    if (d) dispatch({ type: "discover", id: d });
    focusApp(app);
  }, []);

  const select = useCallback((app: AppId, id: string | undefined) => {
    dispatch({ type: "select", app, id });
    const d = discoveryFor(app, id);
    if (d) dispatch({ type: "discover", id: d });
  }, []);

  const close = useCallback((app: AppId) => {
    dispatch({ type: "close", app });
    requestAnimationFrame(() => document.getElementById(`dock-${app}`)?.focus({ preventScroll: true }));
  }, []);

  const home = useCallback(() => {
    stateRef.current.windows.forEach((w) => dispatch({ type: "minimize", app: w.app }));
  }, []);

  // Restore discoveries, and open whatever the URL points at.
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(STORE_KEY) ?? "[]");
      if (Array.isArray(saved)) dispatch({ type: "restoreFound", ids: saved.filter((x) => typeof x === "string") });
    } catch { /* storage unavailable: start fresh */ }
    const fromHash = () => { const t = parseHash(location.hash); if (t) open(t.app, t.select); };
    fromHash();
    addEventListener("hashchange", fromHash);
    return () => removeEventListener("hashchange", fromHash);
  }, [open]);

  useEffect(() => {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(state.found)); } catch { /* ignore */ }
  }, [state.found]);

  // Keep the URL pointing at the focused app, so any view can be shared.
  const top = focusedWindow(state);
  const topSelection = top ? state.selection[top.app] : undefined;
  useEffect(() => {
    const hash = toHash(top?.app, topSelection);
    if (hash !== location.hash) history.replaceState(null, "", hash || location.pathname);
  }, [top?.app, topSelection]);

  // Toasts dismiss themselves.
  useEffect(() => {
    if (!state.toast) return;
    const id = setTimeout(() => dispatch({ type: "dismissToast" }), 4200);
    return () => clearTimeout(id);
  }, [state.toast]);

  // Global shortcuts: 1–5 open apps, ` or Ctrl+K the terminal, Esc closes the top app.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const expected = KONAMI[konami.current];
      konami.current = e.key === expected ? konami.current + 1 : e.key === KONAMI[0] ? 1 : 0;
      if (konami.current === KONAMI.length) { konami.current = 0; discover("konami"); }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") { e.preventDefault(); open("terminal"); return; }
      if (e.key === "Escape") {
        const w = focusedWindow(stateRef.current);
        if (w && !document.querySelector(".os-popover[data-open='true']")) { e.preventDefault(); close(w.app); }
        return;
      }
      if (isTyping(e.target) || e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === "`") { e.preventDefault(); open("terminal"); return; }
      const app = APPS.find((a) => a.key === e.key);
      if (app) { e.preventDefault(); open(app.id); }
    };
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  }, [open, close, discover]);

  const api: OsApi = useMemo(() => ({ state, compact, open, select, close, discover, home }), [state, compact, open, select, close, discover, home]);
  const visible = state.windows.filter((w) => !w.minimized && (!compact || w === top));

  return (
    <OsContext.Provider value={api}>
      <div className="os" data-compact={compact || undefined}>
        <a className="os-skip" href="#os-apps">Skip to apps</a>
        <StatusBar />
        <main className="os__main" ref={desktopRef}>
          <Desktop hidden={compact && !!top} />
          <AnimatePresence>
            {visible.map((w) => (
              <Window key={w.app} win={w} focused={w === top} boundsRef={desktopRef} dispatch={dispatch}>
                {APP_VIEWS[w.app]()}
              </Window>
            ))}
          </AnimatePresence>
        </main>
        <Dock dispatch={dispatch} />
        <DiscoveryToast />
      </div>
    </OsContext.Provider>
  );
}
