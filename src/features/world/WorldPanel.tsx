"use client";

import { useEffect, useState } from "react";
import type { AppId } from "../os/os-types";
import { APOSTRO_FEATURES, AREAS, PANELS } from "./world-content";
import type { PanelId } from "./world-types";

/** The compact card a place opens: a few lines, maybe a screen, and links into the OS. */
export function WorldPanel({ id, onClose, onOpen }: { id: PanelId; onClose: () => void; onOpen: (app: AppId, id?: string) => void }) {
  const p = PANELS[id];
  return (
    <aside className="wpanel" data-screen={p.screen} aria-labelledby={`wp-${id}`}>
      <header className="wpanel__head">
        <p className="wpanel__kicker">{p.kicker}</p>
        <button type="button" className="wpanel__x" onClick={onClose} aria-label="Close"><kbd>Esc</kbd></button>
      </header>
      <h3 className="wpanel__title" id={`wp-${id}`}>{p.title}</h3>
      {p.screen === "dev" && <DevScreen />}
      {p.screen === "apostro" && <ApostroScreen />}
      {p.screen === "clippr" && <ClipprScreen />}
      {p.screen === "map" && <MapScreen />}
      {p.body.filter(Boolean).map((t) => <p key={t} className="wpanel__p">{t}</p>)}
      {p.bullets && <ul className="wpanel__list">{p.bullets.map((b) => <li key={b}>{b}</li>)}</ul>}
      {p.actions.length > 0 && (
        <ul className="wpanel__actions">
          {p.actions.map((a) => (
            <li key={a.label}><button type="button" className="chip chip--project" onClick={() => onOpen(a.app, a.id)}>{a.label} →</button></li>
          ))}
        </ul>
      )}
    </aside>
  );
}

// ---------- The laptop: a small, live development environment ----------

type Tok = [string, string];
const FILES: { name: string; lang: string; lines: Tok[][] }[] = [
  { name: "app/inbox/page.tsx", lang: "TypeScript · React · Next.js", lines: [
    [["k", "export default async function"], ["f", " Inbox"], ["", "() {"]],
    [["", "  const threads = "], ["k", "await"], ["", " db.threads()"]],
    [["", "  return "], ["t", "<ThreadList"], ["", " items={threads} />"]],
    [["", "}"]],
  ] },
  { name: "notify/worker.go", lang: "Go", lines: [
    [["k", "func"], ["", " (w *Worker) "], ["f", "Run"], ["", "(ctx) {"]],
    [["k", "  for"], ["", " job := "], ["k", "range"], ["", " w.queue {"]],
    [["k", "    go"], ["", " w."], ["f", "send"], ["", "(ctx, job)"]],
    [["", "  }"]],
    [["", "}"]],
  ] },
  { name: "api/server.js", lang: "JavaScript · Node.js", lines: [
    [["k", "const"], ["", " app = "], ["f", "express"], ["", "()"]],
    [["", "app."], ["f", "post"], ["", "("], ["s", "'/messages'"], ["", ", async (req, res) => {"]],
    [["k", "  await"], ["", " cache.set(req.body.id, req.body)"]],
    [["", "  res.status("], ["s", "202"], ["", ").end()"]],
    [["", "})"]],
  ] },
];

const TERM = [
  ["$", "docker compose up -d"],
  ["✔", "postgres     started"],
  ["✔", "redis        started"],
  ["✔", "api · node   started"],
  ["✔", "notify · go  started"],
  ["$", "kubectl get pods"],
  ["", "web-7c9f      Running"],
  ["", "notify-5d2a   Running"],
  ["$", "agent run triage"],
  ["▸", "tool · search_threads"],
  ["✔", "deployed · aws"],
];

function DevScreen() {
  const [file, setFile] = useState(0);
  useEffect(() => {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = setInterval(() => setFile((f) => (f + 1) % FILES.length), 5200);
    return () => clearInterval(id);
  }, []);
  const f = FILES[file]!;
  return (
    <div className="dev" aria-hidden="true">
      <div className="dev__bar"><i /><i /><i /><span>~/work</span></div>
      <div className="dev__tabs">
        {FILES.map((x, i) => <span key={x.name} data-on={i === file || undefined}>{x.name.split("/").pop()}</span>)}
      </div>
      <div className="dev__body">
        <pre className="dev__code" key={f.name}>
          {f.lines.map((line, i) => (
            <span key={i} className="dev__line" style={{ "--i": i } as React.CSSProperties}>
              {line.map(([c, t], j) => <b key={j} data-c={c || undefined}>{t}</b>)}
            </span>
          ))}
          <span className="dev__lang">{f.lang}</span>
        </pre>
        <svg className="dev__net" viewBox="0 0 120 100">
          <rect className="dev__cloud" x="30" y="4" width="86" height="92" rx="6" />
          <text x="112" y="13" textAnchor="end">AWS</text>
          {[["M18,50 H44"], ["M66,50 H86"], ["M56,44 V26"], ["M56,56 V76"], ["M98,56 V76"]].map(([d], i) => (
            <path key={d} id={`w${i}`} className="dev__wire" d={d} />
          ))}
          <g className="dev__node"><rect x="2" y="42" width="18" height="16" rx="3" /><text x="11" y="53">web</text></g>
          <g className="dev__node"><rect x="42" y="42" width="26" height="16" rx="3" /><text x="55" y="53">api</text></g>
          <g className="dev__node dev__node--hot"><rect x="84" y="42" width="28" height="16" rx="3" /><text x="98" y="53">go svc</text></g>
          <g className="dev__node dev__node--ai"><rect x="42" y="10" width="28" height="16" rx="3" /><text x="56" y="21">AI</text></g>
          <g className="dev__node"><rect x="38" y="76" width="36" height="16" rx="3" /><text x="56" y="87">postgres</text></g>
          <g className="dev__node"><rect x="82" y="76" width="32" height="16" rx="3" /><text x="98" y="87">redis</text></g>
          <text className="dev__k8s" x="34" y="72">k8s · docker</text>
          {["M18,50 H44", "M66,50 H86", "M56,44 V26", "M56,56 V76", "M98,56 V76"].map((d, i) => (
            <circle key={d} r="1.8" className="dev__packet" style={{ offsetPath: `path('${d}')`, animationDelay: `${i * 0.45}s` } as React.CSSProperties} />
          ))}
        </svg>
        <pre className="dev__term">
          {TERM.map(([m, t], i) => <span key={i} style={{ "--i": i } as React.CSSProperties} data-m={m}><b>{m}</b> {t}</span>)}
        </pre>
      </div>
    </div>
  );
}

// ---------- The London workstation: a simplified Apostro ----------

function ApostroScreen() {
  return (
    <div className="ap" aria-hidden="true">
      <div className="ap__side">
        <span className="ap__logo">A<i>postro</i></span>
        {APOSTRO_FEATURES.slice(0, 6).map((f, i) => <span key={f} data-on={i === 2 || undefined}>{f}</span>)}
      </div>
      <div className="ap__main">
        <div className="ap__top"><b /><span>AI</span></div>
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="ap__row" style={{ "--i": i } as React.CSSProperties}><b /><i data-s={i % 3} /></div>
        ))}
      </div>
      <span className="ap__note">Illustrative</span>
    </div>
  );
}

// ---------- The booking desk: TheClippr's week ----------

function ClipprScreen() {
  const days = ["M", "T", "W", "T", "F", "S"];
  const booked = [[0, 1], [0, 3], [1, 0], [1, 2], [2, 1], [3, 0], [3, 3], [4, 1], [4, 2], [5, 0], [5, 1], [5, 3]];
  return (
    <div className="clip" aria-hidden="true">
      {days.map((d, x) => (
        <div key={x} className="clip__day">
          <span>{d}</span>
          {[0, 1, 2, 3].map((y) => {
            const i = booked.findIndex(([bx, by]) => bx === x && by === y);
            return <b key={y} data-on={i >= 0 || undefined} style={{ "--i": i } as React.CSSProperties} />;
          })}
        </div>
      ))}
    </div>
  );
}

// ---------- The signpost: where everything is ----------

function MapScreen() {
  const pos: Record<string, React.CSSProperties> = {
    repair: { left: "4%", top: "8%" }, workspace: { right: "4%", top: "8%" },
    barbershop: { left: "4%", bottom: "8%" }, london: { right: "4%", bottom: "8%" },
  };
  return (
    <div className="wmap" aria-label="Map of HONEYBADGER">
      <span className="wmap__path" aria-hidden="true" />
      {AREAS.map((a) => (
        <span key={a.id} className="wmap__place" style={pos[a.id]}>
          <b>{a.n}</b> {a.name}
        </span>
      ))}
      <span className="wmap__here" aria-hidden="true">● you</span>
    </div>
  );
}
