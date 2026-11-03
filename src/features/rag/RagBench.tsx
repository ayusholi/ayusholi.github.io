"use client";

import { useCallback, useState } from "react";
import { BenchFrame } from "@/components/simulation/BenchFrame";
import { LiveDiagram } from "@/components/simulation/LiveDiagram";
import type { DiagramLayout, DiagramNode } from "@/components/simulation/SystemDiagram";
import { Segmented } from "@/components/ui/Segmented";
import { useTimelineFrame } from "@/lib/simulation/useTimeline";
import { useRag } from "./RagProvider";
import { describe, ROLES } from "./rag-content";
import * as engine from "./rag-engine";
import { ACTIONS, SCENARIOS, type ScenarioId } from "./rag-scenarios";
import type { RagFrame, RagNodeId, RagState, Retrieval, SearchMode } from "./rag-types";

const IDS: RagNodeId[] = ["docs", "chunker", "index", "user", "retriever", "model"];
const EDGES: [RagNodeId, RagNodeId][] = [["docs", "chunker"], ["chunker", "index"], ["user", "retriever"], ["retriever", "index"], ["retriever", "model"], ["model", "user"]];
const LAYOUT: DiagramLayout = (w) => (w < 620
  ? { height: 540, at: { docs: [0.25, 50], chunker: [0.75, 50], index: [0.75, 200], retriever: [0.25, 200], user: [0.25, 470], model: [0.75, 470] } }
  : { height: 380, at: { docs: [0.1, 70], chunker: [0.4, 70], index: [0.82, 70], user: [0.1, 310], retriever: [0.6, 190], model: [0.4, 310] } });
const HEIGHTS = { wide: 380, narrow: 540 };

const counters = (s: RagState) => [
  ["chunks", "Chunks indexed", s.index.length], ["questions", "Questions", s.stats.questions], ["grounded", "Answers with a source", s.stats.grounded],
  ["notFound", "“Not in the docs”", s.stats.notFound], ["unsupported", "Answers with no source", s.stats.unsupported], ["stale", "Out-of-date answers", s.stats.stale],
] as const;

const nodesFor = (frame: RagFrame, instant: boolean, selected: string | null): DiagramNode[] => {
  const s = frame.state;
  const behind = engine.outdated(s).length;
  return IDS.map((id) => {
    const role = ROLES[id];
    const node: DiagramNode = { id, name: role.name, sub: role.sub, ariaLabel: `${role.name}: ${role.sub}. Inspect`, active: frame.at === id && !instant, selected: selected === id };
    if (id === "docs") node.tag = `${s.docs.length} docs`;
    if (id === "index") {
      node.sub = s.index.length ? `${s.index.length} chunks` : "empty";
      if (behind && s.index.length) node.tag = `${behind} doc${behind === 1 ? "" : "s"} behind`;
      node.down = !s.index.length;
    }
    if (id === "retriever") {
      node.sub = s.retrieval === "off" ? "Off: passes through" : s.mode === "vector" ? "Vector search" : "Keyword search";
      if (s.hits.length) node.tag = `best ${s.hits[0]?.score}`;
    }
    if (id === "user" && s.answer) node.tag = s.answer.kind === "grounded" ? (s.answer.stale ? "cited · stale" : "cited") : s.answer.kind === "not-found" ? "not in docs" : "no source";
    return node;
  });
};

const Hits = ({ s }: { s: RagState }) => (
  <table className="keys mono">
    <thead><tr><th>chunk</th><th>text</th><th>score</th></tr></thead>
    <tbody>
      {s.hits.map((h) => (
        <tr key={`${s.stats.questions}-${h.chunk.id}-${h.chunk.version}`} className={h.used ? "is-diff" : "is-ghost"}>
          <td>{h.chunk.id}{engine.isStale(s, h.chunk) ? " (old)" : ""}</td>
          <td>{h.chunk.text}</td>
          <td>{h.score.toFixed(2)}<span className="ttlbar" style={{ transform: `scaleX(${h.score})` }} /></td>
        </tr>
      ))}
    </tbody>
  </table>
);

export const RagBench = () => {
  const { timeline, scenario, lesson, act, runScenario, reset } = useRag();
  const frame = useTimelineFrame(timeline);
  const [selected, setSelected] = useState<RagNodeId | null>(null);
  const present = timeline.present;
  const s = frame.state;
  const behind = engine.outdated(present).length;

  return (
    <BenchFrame
      timeline={timeline}
      tabs={(Object.entries(SCENARIOS) as [ScenarioId, (typeof SCENARIOS)[ScenarioId]][]).map(([id, sc]) => ({ id, label: sc.label, title: sc.title }))}
      current={scenario}
      lesson={lesson}
      onTab={(id) => runScenario(id as ScenarioId)}
      onFirstSight={useCallback(() => runScenario("grounded"), [runScenario])}
      stage={<LiveDiagram timeline={timeline} frame={frame} nodes={nodesFor(frame, timeline.instant, selected)} edges={EDGES} layout={LAYOUT} heights={HEIGHTS} onSelect={(id) => setSelected(selected === id ? null : id as RagNodeId)} />}
      inspect={selected && ROLES[selected]}
      caption={describe(frame)}
      speak={!timeline.running}
      position={(tl) => `step ${Math.max(0, tl.cursor - tl.traceStart + 1)}/${Math.max(0, tl.frames.length - tl.traceStart)}`}
      controls={<>
        <div className="control">
          <span className="label">Ask</span>
          <button type="button" className="btn btn--solid btn--wide" id="ask-return" onClick={() => act(ACTIONS.ask("return"))}>How long to send a jacket back?</button>
          <div className="control__row">
            <button type="button" className="btn" id="ask-refund" onClick={() => act(ACTIONS.ask("refund"))}>Money back?</button>
            <button type="button" className="btn" id="ask-ship" onClick={() => act(ACTIONS.ask("ship"))}>Free delivery?</button>
          </div>
          <button type="button" className="btn btn--wide" id="ask-kayak" onClick={() => act(ACTIONS.ask("kayak"))}>Do you sell kayaks?</button>
        </div>
        <div className="control">
          <span className="label">Retrieval</span>
          <Segmented<Retrieval> id="retrieval" label="Retrieval" value={present.retrieval} options={[["on", "On"], ["off", "Off"]]} onChange={(retrieval) => act((st) => engine.configure(st, { retrieval }))} />
          <Segmented<SearchMode> id="mode" label="Search" value={present.mode} options={[["vector", "Vectors"], ["keyword", "Keywords"]]} onChange={(mode) => act((st) => engine.configure(st, { mode }))} />
        </div>
        <div className="control">
          <span className="label">Documents</span>
          <button type="button" className="btn btn--wide" id="update-policy" disabled={!engine.updatePolicy(present)} onClick={() => act(ACTIONS.updatePolicy())}>Change returns to 14 days</button>
          <button type="button" className="btn btn--wide" id="reindex" disabled={!behind} onClick={() => act(ACTIONS.reindex())}>{present.index.length ? `Re-index${behind ? ` (${behind} changed)` : ""}` : "Index the documents"}</button>
          <button type="button" className="btn btn--wide" id="reset" onClick={reset}>Reset</button>
        </div>
      </>}
      readouts={
        <div className="readouts">
          <div className="readout">
            <div className="readout__h label"><span>Nearest chunks</span><span>bold: used · faint: under {engine.THRESHOLD}</span></div>
            <div id="hits"><Hits s={s} /></div>
          </div>
          <div className="readout">
            <div className="readout__h label"><span>Counters</span></div>
            <div className="counters" id="counters">
              {counters(s).map(([k, name, value]) => <div className="counter" data-c={k} key={k}><b key={value}>{value}</b><span className="label">{name}</span></div>)}
            </div>
          </div>
        </div>
      }
      titleblock={["Sheet 09 · From question to cited answer", "Three documents, one chunk per sentence", "Nine-dimension embeddings"]}
    />
  );
};
