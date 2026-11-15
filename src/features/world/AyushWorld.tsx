"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useOs } from "../os/OsContext";
import type { AppId } from "../os/os-types";
import { MobileControls } from "./MobileControls";
import { WorldPanel } from "./WorldPanel";
import { RISE, buildSprites, render } from "./render";
import { AREAS, KINDS, PANELS } from "./world-content";
import { areaAt, createWorld, follow, interact, near, step, target } from "./world-engine";
import type { AreaId, Input, PanelId, Prop, Target } from "./world-types";

// By physical key, so WASD works on any layout and Shift can't strand a key.
const KEYS: Record<string, [number, number]> = {
  ArrowUp: [0, -1], KeyW: [0, -1],
  ArrowDown: [0, 1], KeyS: [0, 1],
  ArrowLeft: [-1, 0], KeyA: [-1, 0],
  ArrowRight: [1, 0], KeyD: [1, 0],
};

const hintFor = (t: Target | null, riding: boolean) =>
  !t ? null : t.kind === "bike" ? (riding ? "Get off" : "Ride") : t.prop.panel === "signpost" ? "Read" : "Interact";

/** HONEYBADGER: a small walkable map of the story, inside the desktop. */
export function AyushWorld() {
  const { open } = useOs();
  const frameRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const hintRef = useRef<HTMLDivElement>(null);
  const world = useRef(createWorld());
  const keys = useRef(new Map<string, [number, number]>());
  const pad = useRef<[number, number]>([0, 0]);
  const run = useRef(false);
  const panelRef = useRef<{ id: PanelId; prop: Prop } | null>(null);

  const [panel, setPanel] = useState<{ id: PanelId; prop: Prop } | null>(null);
  const [hint, setHint] = useState<string | null>(null);
  const [riding, setRiding] = useState(false);
  const [area, setArea] = useState<AreaId | null>(null);
  const [focused, setFocused] = useState(false);
  const [live, setLive] = useState("");
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => { panelRef.current = panel; }, [panel]);

  const closePanel = useCallback(() => setPanel(null), []);

  const act = useCallback(() => {
    const s = world.current;
    const a = interact(s);
    if (a.type === "panel") {
      setPanel((cur) => (cur?.id === a.panel ? null : { id: a.panel, prop: a.prop }));
      setLive(`${PANELS[a.panel].title}`);
    } else if (a.type === "mount" || a.type === "dismount") {
      setRiding(a.type === "mount");
      setPanel(null);
      setLive(a.type === "mount" ? "Riding the bicycle" : "Got off the bicycle");
    } else if (a.type === "blocked") setLive(a.text);
  }, []);

  // ---------- The loop ----------
  useEffect(() => {
    const canvas = canvasRef.current, frame = frameRef.current;
    if (!canvas || !frame) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const sprites = buildSprites();
    const s = world.current;
    const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
    s.still = still;
    let W = 0, H = 0, zoom = 2, dpr = 1, raf = 0, last = 0, visible = false, first = true;
    let lastHint = "", lastArea: AreaId | null = null, lastNote: string | null = null;

    const size = () => {
      const r = frame.getBoundingClientRect();
      dpr = Math.min(3, window.devicePixelRatio || 1);
      W = Math.max(1, Math.round(r.width * dpr)); H = Math.max(1, Math.round(r.height * dpr));
      canvas.width = W; canvas.height = H;
      zoom = Math.max(1, Math.floor(Math.min(W / 330, H / 190)));
      follow(s, W / zoom, H / zoom, 0, true);
    };

    const input = (): Input => {
      let x = pad.current[0], y = pad.current[1];
      keys.current.forEach(([kx, ky]) => { x += kx; y += ky; });
      return { x: Math.max(-1, Math.min(1, x)), y: Math.max(-1, Math.min(1, y)), run: run.current };
    };

    const tick = (now: number) => {
      const dt = first ? 0 : Math.min(0.05, (now - last) / 1000);
      first = false; last = now;
      step(s, input(), dt);
      follow(s, W / zoom, H / zoom, dt, still);
      const tg = target(s);
      const open = panelRef.current;
      render(ctx, s, sprites, W, H, zoom, { target: tg, activeProp: open?.prop.id, t: still ? 2 : s.t });

      // Keep the DOM overlays in step without re-rendering React every frame.
      const label = hintFor(tg, s.player.riding) ?? "";
      const key = tg ? (tg.kind === "bike" ? `bike:${s.player.riding}` : tg.prop.id) : "";
      if (key !== lastHint) { lastHint = key; setHint(label || null); }
      const el = hintRef.current;
      if (el && tg) {
        let wx: number, wy: number;
        if (tg.kind === "bike") { wx = s.player.riding ? s.player.x : s.bike.x; wy = (s.player.riding ? s.player.y - 36 : s.bike.y - 28); }
        else { const k = KINDS[tg.prop.kind]; wx = tg.prop.x + k.w / 2; wy = tg.prop.y - (RISE[tg.prop.kind] ?? 0) - 12; }
        const z = zoom / dpr;
        el.style.transform = `translate(${Math.round((wx - Math.round(s.cam.x * zoom) / zoom) * z)}px, ${Math.round((wy - Math.round(s.cam.y * zoom) / zoom) * z)}px) translate(-50%, -100%)`;
      }
      const a = areaAt(s.player.x, s.player.y);
      if (a !== lastArea) { lastArea = a; setArea(a); }
      const n = s.note?.text ?? null;
      if (n !== lastNote) { lastNote = n; setNote(n); if (n) setLive(n); }
      if (open && !near(s, open.prop)) setPanel(null);

      if (visible) raf = requestAnimationFrame(tick);
    };

    const start = () => { if (!raf && visible && !document.hidden) { first = true; raf = requestAnimationFrame(tick); } };
    const stop = () => { cancelAnimationFrame(raf); raf = 0; };

    size();
    const ro = new ResizeObserver(() => { size(); if (!raf) render(ctx, s, sprites, W, H, zoom, { target: null, t: 2 }); });
    ro.observe(frame);
    // Only run while it's on screen and the tab is visible.
    const io = new IntersectionObserver(([e]) => { visible = !!e?.isIntersecting; if (visible) start(); else stop(); });
    io.observe(frame);
    const onVis = () => (document.hidden ? stop() : start());
    document.addEventListener("visibilitychange", onVis);
    return () => { stop(); ro.disconnect(); io.disconnect(); document.removeEventListener("visibilitychange", onVis); };
  }, []);

  // ---------- Keyboard: only while the world has focus ----------
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key === "Escape" && panelRef.current) {
      e.stopPropagation(); e.preventDefault();
      setPanel(null); frameRef.current?.focus({ preventScroll: true });
      return;
    }
    const inPanel = (e.target as HTMLElement).closest(".wpanel, .wpad");
    if (inPanel) return;
    const k = KEYS[e.code];
    if (k) { e.preventDefault(); keys.current.set(e.code, k); return; }
    if (e.key === "Shift") run.current = true;
    if ((e.code === "KeyE" || e.key === "Enter" || e.key === " ") && !e.repeat) { e.preventDefault(); act(); }
  };
  const onKeyUp = (e: React.KeyboardEvent) => {
    keys.current.delete(e.code);
    if (e.key === "Shift") run.current = false;
  };
  const onBlur = (e: React.FocusEvent) => {
    if (frameRef.current?.contains(e.relatedTarget as Node)) return;
    keys.current.clear(); run.current = false; setFocused(false);
  };

  const openApp = (app: AppId, id?: string) => open(app, id);
  const areaInfo = AREAS.find((a) => a.id === area);

  return (
    <section className="world" aria-labelledby="world-title">
      <header className="world__head">
        <h2 className="world__cap" id="world-title"><span>HONEYBADGER</span> walk through the story</h2>
        <p className="world__keys" aria-hidden="true"><kbd>WASD</kbd> move <kbd>E</kbd> interact <kbd>Shift</kbd> run</p>
      </header>
      <div
        className="world__frame" ref={frameRef} tabIndex={0} role="application" data-focused={focused || undefined}
        aria-label="HONEYBADGER, an explorable map. Arrow keys or W A S D move, E interacts, Escape closes a panel."
        onKeyDown={onKeyDown} onKeyUp={onKeyUp} onFocus={() => setFocused(true)} onBlur={onBlur}
        onPointerDown={(e) => { if (!(e.target as HTMLElement).closest(".wpanel, .wpad")) frameRef.current?.focus({ preventScroll: true }); }}
      >
        <canvas ref={canvasRef} className="world__canvas" aria-hidden="true" />
        <div ref={hintRef} className="world__hint" hidden={!hint || riding}>
          <kbd>E</kbd> {hint}
        </div>
        {riding && <p className="world__riding"><kbd>E</kbd> get off · riding</p>}
        {note && <p className="world__note">{note}</p>}
        {areaInfo && <p className="world__area" key={areaInfo.id}><span>{areaInfo.n}</span>{areaInfo.name}</p>}
        {!focused && <p className="world__start" aria-hidden="true"><span>▶</span> Click to explore</p>}
        {panel && <WorldPanel id={panel.id} onClose={() => { closePanel(); frameRef.current?.focus({ preventScroll: true }); }} onOpen={openApp} />}
        <MobileControls padRef={pad} onAct={act} />
        <p className="sr-only" aria-live="polite">{live}</p>
      </div>
    </section>
  );
}
