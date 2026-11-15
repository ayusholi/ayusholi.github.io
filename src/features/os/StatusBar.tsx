"use client";

import { AnimatePresence, m } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { Glyph } from "./Glyph";
import { useNow, useOs } from "./OsContext";
import { DISCOVERIES, IDENTITY } from "./os-content";

const day = new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "Europe/London" });
const time = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/London" });

export function StatusBar() {
  const { state, open, home } = useOs();
  const now = useNow();
  return (
    <header className="bar">
      <button type="button" className="bar__brand" onClick={home} aria-label="AYUSH.OS: show desktop">
        <span className="bar__mark" aria-hidden="true" />
        {IDENTITY.system}
      </button>
      <p className="bar__status">
        <span className="bar__dot" aria-hidden="true" /> <span className="bar__online">online</span>
        <span className="bar__sep bar__wide" aria-hidden="true">/</span> <span className="bar__wide">{IDENTITY.location}</span>
        <span className="bar__sep bar__wide" aria-hidden="true">/</span> <span className="bar__wide">{IDENTITY.current}</span>
      </p>
      <div className="bar__right">
        <Discoveries found={state.found} />
        <button type="button" className="bar__btn" onClick={() => open("terminal")} aria-label="Open terminal" title="Terminal ( ` or Ctrl+K )">
          <Glyph app="terminal" size={15} /><span className="bar__wide">Terminal</span>
        </button>
        <time className="bar__clock" suppressHydrationWarning>{now && <><span className="bar__wide">{day.format(now)} </span>{time.format(now)}</>}</time>
      </div>
    </header>
  );
}

// The discoveries panel: what's been found, and a hint for what hasn't.
function Discoveries({ found }: { found: string[] }) {
  const [openPanel, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!openPanel) return;
    const onDown = (e: PointerEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { e.stopPropagation(); setOpen(false); } };
    addEventListener("pointerdown", onDown);
    addEventListener("keydown", onKey, true);
    return () => { removeEventListener("pointerdown", onDown); removeEventListener("keydown", onKey, true); };
  }, [openPanel]);

  const real = DISCOVERIES.filter((d) => !d.egg), eggs = DISCOVERIES.filter((d) => d.egg);
  const row = (d: (typeof DISCOVERIES)[number]) => {
    const got = found.includes(d.id);
    return (
      <li key={d.id} className="disc__item" data-found={got || undefined}>
        <span className="disc__mark" aria-hidden="true">{got ? "◆" : "◇"}</span>
        <span>
          <strong>{got ? d.title : "Undiscovered"}</strong>
          <small>{got ? d.detail : d.hint}</small>
        </span>
      </li>
    );
  };

  return (
    <div className="os-popover" ref={ref} data-open={openPanel}>
      <button type="button" className="bar__btn" aria-expanded={openPanel} aria-controls="disc-panel" onClick={() => setOpen((o) => !o)}>
        <span aria-hidden="true">◆</span> {found.length}<span className="bar__dim">/{DISCOVERIES.length}</span>
        <span className="sr-only"> discoveries found</span><span className="bar__wide">Discoveries</span>
      </button>
      {openPanel && (
        <div className="disc" id="disc-panel" role="dialog" aria-label="Discoveries">
          <p className="disc__head">Discoveries <span>{found.length} of {DISCOVERIES.length} found</span></p>
          <p className="disc__note">Found by exploring. Each one is a real piece of work.</p>
          <ul className="disc__list">{real.map(row)}</ul>
          <p className="disc__sub">Easter eggs</p>
          <ul className="disc__list">{eggs.map(row)}</ul>
        </div>
      )}
    </div>
  );
}

export function DiscoveryToast() {
  const { state } = useOs();
  const d = DISCOVERIES.find((x) => x.id === state.toast);
  return (
    <div className="toast-slot" role="status" aria-live="polite">
      <AnimatePresence>
        {d && (
          <m.div key={d.id} className="toast" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 6 }} transition={{ duration: 0.25 }}>
            <span className="toast__label">{d.egg ? "Easter egg found" : "Discovery"}</span>
            <strong>{d.title}</strong>
            <span>{d.detail}</span>
          </m.div>
        )}
      </AnimatePresence>
    </div>
  );
}
