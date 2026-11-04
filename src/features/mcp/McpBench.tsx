"use client";

import { useCallback, useState } from "react";
import { BenchFrame } from "@/components/simulation/BenchFrame";
import { LiveDiagram } from "@/components/simulation/LiveDiagram";
import type { DiagramLayout, DiagramNode } from "@/components/simulation/SystemDiagram";
import { Segmented } from "@/components/ui/Segmented";
import { useTimelineFrame } from "@/lib/simulation/useTimeline";
import { useMcp } from "./McpProvider";
import { describe, ROLES } from "./mcp-content";
import * as engine from "./mcp-engine";
import { ACTIONS, SCENARIOS, type ScenarioId } from "./mcp-scenarios";
import type { Approval, McpFrame, McpNodeId, McpState, ServerId, Transport } from "./mcp-types";

const IDS: McpNodeId[] = ["user", "host", "model", "files", "calendar"];
const EDGES: [McpNodeId, McpNodeId][] = [["user", "host"], ["host", "model"], ["host", "files"], ["host", "calendar"]];
const LAYOUT: DiagramLayout = (w) => (w < 620
  ? { height: 440, at: { user: [0.25, 50], model: [0.75, 50], host: [0.5, 200], files: [0.25, 370], calendar: [0.75, 370] } }
  : { height: 380, at: { user: [0.09, 190], host: [0.42, 190], model: [0.42, 330], files: [0.82, 100], calendar: [0.82, 280] } });
const HEIGHTS = { wide: 380, narrow: 440 };
const SERVER_IDS: ServerId[] = ["files", "calendar"];

const counters = (s: McpState) => [
  ["servers", "Servers connected", s.stats.servers], ["tools", "Tools available", s.stats.tools], ["messages", "JSON-RPC messages", s.stats.messages],
  ["toolCalls", "Tool calls", s.stats.toolCalls], ["toolErrors", "Tool errors", s.stats.toolErrors], ["approvals", "Approvals asked", s.stats.approvals],
] as const;

const nodesFor = (frame: McpFrame, instant: boolean, selected: string | null): DiagramNode[] => {
  const s = frame.state;
  return IDS.map((id) => {
    const role = ROLES[id];
    const node: DiagramNode = { id, name: role.name, sub: role.sub, ariaLabel: `${role.name}: ${role.sub}. Inspect`, active: frame.at === id && !instant, selected: selected === id };
    if (id === "user" && s.pending) node.tag = "allow?";
    if (id === "host") node.sub = `${s.connected.length} MCP client${s.connected.length === 1 ? "" : "s"}`;
    if (id === "model") node.tag = `${s.tools.length} tool${s.tools.length === 1 ? "" : "s"}`;
    if (id === "files" || id === "calendar") {
      const on = s.connected.includes(id);
      node.sub = on ? (s.transport === "stdio" ? "stdio · local process" : "HTTP · remote") : "Not connected";
      node.rested = !on && frame.server !== id;
      if (frame.tool && frame.server === id) node.tag = frame.tool;
      node.down = frame.type === "call.result" && frame.server === id && !!s.chat[s.chat.length - 1]?.isError;
    }
    return node;
  });
};

const Wire = ({ s }: { s: McpState }) => (
  <table className="keys mono">
    <thead><tr><th></th><th>server</th><th>message</th></tr></thead>
    <tbody>
      {s.rpc.length ? [...s.rpc].reverse().map((r, i) => {
        const m = JSON.parse(r.json) as { id?: number; method?: string; result?: { isError?: boolean; tools?: unknown[] } };
        const what = m.method ?? (m.result?.tools ? `result: ${m.result.tools.length} tools` : m.result?.isError ? "result: isError" : "result");
        return <tr key={`${s.stats.messages - i}`}><td>{r.dir}</td><td>{r.server}</td><td>{m.id !== undefined ? `#${m.id} ` : ""}{what}</td></tr>;
      }) : <tr><td></td><td>–</td><td>(nothing yet)</td></tr>}
    </tbody>
  </table>
);

export const McpBench = () => {
  const { timeline, scenario, lesson, act, runScenario, reset } = useMcp();
  const frame = useTimelineFrame(timeline);
  const [selected, setSelected] = useState<McpNodeId | null>(null);
  const present = timeline.present;
  const s = frame.state;
  const busy = !!present.pending;

  return (
    <BenchFrame
      timeline={timeline}
      tabs={(Object.entries(SCENARIOS) as [ScenarioId, (typeof SCENARIOS)[ScenarioId]][]).map(([id, sc]) => ({ id, label: sc.label, title: sc.title }))}
      current={scenario}
      lesson={lesson}
      onTab={(id) => runScenario(id as ScenarioId)}
      onFirstSight={useCallback(() => runScenario("handshake"), [runScenario])}
      stage={<LiveDiagram timeline={timeline} frame={frame} nodes={nodesFor(frame, timeline.instant, selected)} edges={EDGES} layout={LAYOUT} heights={HEIGHTS} onSelect={(id) => setSelected(selected === id ? null : id as McpNodeId)} />}
      inspect={selected && ROLES[selected]}
      caption={describe(frame)}
      speak={!timeline.running}
      position={(tl) => `step ${Math.max(0, tl.cursor - tl.traceStart + 1)}/${Math.max(0, tl.frames.length - tl.traceStart)}`}
      controls={<>
        <div className="control">
          <span className="label">Servers</span>
          <div className="control__row">
            {SERVER_IDS.map((id) => (
              <button key={id} type="button" className="btn" id={`connect-${id}`} aria-pressed={present.connected.includes(id)} disabled={busy} onClick={() => act(ACTIONS.connect(id))}>{present.connected.includes(id) ? `Disconnect ${id}` : `Connect ${id}`}</button>
            ))}
          </div>
          <Segmented<Transport> id="transport" label="Transport" value={present.transport} options={[["stdio", "stdio"], ["http", "HTTP"]]} onChange={(transport) => act((st) => engine.configure(st, { transport }))} />
        </div>
        <div className="control">
          <span className="label">Ask</span>
          <button type="button" className="btn btn--solid btn--wide" id="ask-notes" disabled={busy} onClick={() => act(ACTIONS.ask("notes"))}>What&apos;s in notes.txt?</button>
          <div className="control__row">
            <button type="button" className="btn" id="ask-missing" disabled={busy} onClick={() => act(ACTIONS.ask("missing"))}>Summarise todo.txt</button>
            <button type="button" className="btn" id="ask-free" disabled={busy} onClick={() => act(ACTIONS.ask("free"))}>Free at 3pm?</button>
          </div>
          <button type="button" className="btn btn--wide" id="ask-book" disabled={busy} onClick={() => act(ACTIONS.ask("book"))}>Book a call at 3pm</button>
        </div>
        <div className="control">
          <span className="label">Approval</span>
          <Segmented<Approval> id="approval" label="Approval" value={present.approval} options={[["ask", "Ask before writes"], ["auto", "Allow all"]]} onChange={(approval) => act((st) => engine.configure(st, { approval }))} />
          <div className="control__row">
            <button type="button" className="btn" id="approve" disabled={!present.pending} onClick={() => act(ACTIONS.approve())}>Allow</button>
            <button type="button" className="btn" id="deny" disabled={!present.pending} onClick={() => act(ACTIONS.deny())}>Deny</button>
          </div>
          <button type="button" className="btn btn--wide" id="reset" onClick={reset}>Reset</button>
        </div>
      </>}
      readouts={
        <div className="readouts">
          <div className="readout">
            <div className="readout__h label"><span>JSON-RPC, newest first</span><span>→ host to server ← reply</span></div>
            <div id="wire"><Wire s={s} /></div>
          </div>
          <div className="readout">
            <div className="readout__h label"><span>Counters</span></div>
            <div className="counters" id="counters">
              {counters(s).map(([k, name, value]) => <div className="counter" data-c={k} key={k}><b key={value}>{value}</b><span className="label">{name}</span></div>)}
            </div>
          </div>
        </div>
      }
      titleblock={["Sheet 14 · One host, many servers", "Two servers, four tools", "Model choices fixed per question"]}
    />
  );
};
