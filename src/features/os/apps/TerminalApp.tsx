"use client";

import { useEffect, useRef, useState } from "react";
import { toMonth, useOs } from "../OsContext";
import { complete, runCommand } from "../os-engine";
import type { TermLine } from "../os-types";

const PROMPT = "visitor@ayush.os:~$";
const WELCOME: TermLine[] = [
  { kind: "accent", text: "AYUSH.OS shell" },
  { kind: "dim", text: "Type help for commands. Try: whoami · ls projects · stack go · open broadway" },
];

export function TerminalApp() {
  const { open, close, discover } = useOs();
  const [lines, setLines] = useState<TermLine[]>(WELCOME);
  const [value, setValue] = useState("");
  const history = useRef<string[]>([]);
  const cursor = useRef(-1);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { endRef.current?.scrollIntoView({ block: "nearest" }); }, [lines]);

  const submit = () => {
    const cmd = value;
    setValue("");
    cursor.current = -1;
    if (cmd.trim()) history.current = [cmd, ...history.current].slice(0, 50);
    const result = runCommand(cmd, toMonth(new Date()));
    const echoed: TermLine = { kind: "in", text: cmd };
    let next = [...lines, echoed, ...result.lines];
    if (cmd.trim()) discover("terminal");
    for (const fx of result.effects) {
      if (fx.type === "clear") next = [];
      if (fx.type === "discover") discover(fx.id);
      if (fx.type === "close") { close("terminal"); return; }
      if (fx.type === "open") open(fx.app, fx.select);
    }
    setLines(next.slice(-400));
  };

  const onKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") { e.preventDefault(); submit(); }
    else if (e.key === "Tab") { e.preventDefault(); setValue((v) => complete(v)); }
    else if (e.key === "ArrowUp" || e.key === "ArrowDown") {
      e.preventDefault();
      const h = history.current;
      cursor.current = Math.max(-1, Math.min(h.length - 1, cursor.current + (e.key === "ArrowUp" ? 1 : -1)));
      setValue(cursor.current < 0 ? "" : h[cursor.current] ?? "");
    } else if (e.key === "l" && e.ctrlKey) { e.preventDefault(); setLines([]); }
  };

  return (
    <div className="term" onClick={() => { if (!window.getSelection()?.toString()) inputRef.current?.focus(); }}>
      <div className="term__out" role="log" aria-live="polite" aria-label="Terminal output">
        {lines.map((l, i) => (
          <p key={i} className="term__line" data-kind={l.kind}>
            {l.kind === "in" && <span className="term__prompt" aria-hidden="true">{PROMPT} </span>}{l.text}
          </p>
        ))}
        <div ref={endRef} />
      </div>
      <form className="term__in" onSubmit={(e) => { e.preventDefault(); submit(); }}>
        <label htmlFor="term-input" className="term__prompt">{PROMPT}</label>
        <input id="term-input" ref={inputRef} value={value} onChange={(e) => setValue(e.target.value)} onKeyDown={onKey}
          autoComplete="off" autoCapitalize="off" spellCheck={false} enterKeyHint="send" aria-label="Command" />
      </form>
    </div>
  );
}
