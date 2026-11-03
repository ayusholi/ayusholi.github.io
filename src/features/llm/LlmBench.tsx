"use client";

import { useCallback, useState } from "react";
import { BenchFrame } from "@/components/simulation/BenchFrame";
import { LiveDiagram } from "@/components/simulation/LiveDiagram";
import type { DiagramLayout, DiagramNode } from "@/components/simulation/SystemDiagram";
import { Segmented } from "@/components/ui/Segmented";
import { useTimelineFrame } from "@/lib/simulation/useTimeline";
import { useLlm } from "./LlmProvider";
import { describe, ROLES } from "./llm-content";
import * as engine from "./llm-engine";
import { ACTIONS, SCENARIOS, type ScenarioId } from "./llm-scenarios";
import type { LlmFrame, LlmNodeId, LlmState, Temperature, WindowSize } from "./llm-types";

const IDS: LlmNodeId[] = ["prompt", "tokenizer", "context", "model", "sampler", "output"];
const EDGES: [LlmNodeId, LlmNodeId][] = [["prompt", "tokenizer"], ["tokenizer", "context"], ["context", "model"], ["model", "sampler"], ["sampler", "output"], ["output", "context"]];
const LAYOUT: DiagramLayout = (w) => (w < 620
  ? { height: 540, at: { prompt: [0.25, 50], tokenizer: [0.75, 50], context: [0.5, 185], model: [0.25, 330], sampler: [0.75, 330], output: [0.5, 470] } }
  : { height: 380, at: { prompt: [0.1, 80], tokenizer: [0.1, 300], context: [0.37, 190], model: [0.63, 80], sampler: [0.88, 190], output: [0.63, 300] } });
const HEIGHTS = { wide: 380, narrow: 540 };
const PROMPT_LABEL = { capital: "France", name: "My name", unknown: "Chess champion" } as const;

const counters = (s: LlmState) => [
  ["promptTokens", "Prompt tokens", s.stats.promptTokens], ["generated", "Forward passes", s.stats.generated], ["inContext", "In the window now", s.context.length],
  ["dropped", "Fell out of the window", s.stats.dropped], ["offTop", "Not the top choice", s.stats.offTop], ["unsure", "Picks under 50%", s.stats.unsure],
] as const;

const nodesFor = (frame: LlmFrame, instant: boolean, selected: string | null): DiagramNode[] => {
  const s = frame.state;
  return IDS.map((id) => {
    const role = ROLES[id];
    const node: DiagramNode = { id, name: role.name, sub: role.sub, ariaLabel: `${role.name}: ${role.sub}. Inspect`, active: frame.at === id && !instant, selected: selected === id };
    if (id === "prompt" && s.prompt) node.sub = PROMPT_LABEL[s.prompt];
    if (id === "tokenizer" && s.stats.promptTokens) node.tag = `${s.stats.promptTokens} tokens`;
    if (id === "context") {
      node.sub = `${s.context.length}/${s.windowSize} tokens`;
      if (s.stats.dropped) node.tag = `${s.stats.dropped} dropped`;
    }
    if (id === "model" && s.stats.generated) node.tag = `pass ${s.stats.generated}`;
    if (id === "sampler") {
      node.sub = `temperature ${s.temperature}`;
      if (s.picked) node.tag = engine.show(s.picked);
    }
    if (id === "output") {
      node.sub = s.output.length ? `“${engine.text(s).trim().slice(-18)}”` : "nothing yet";
      if (s.done) node.tag = s.done === "stop" ? "<end>" : "max_tokens";
    }
    return node;
  });
};

const Candidates = ({ s }: { s: LlmState }) => (
  <table className="keys mono">
    <thead><tr><th>next token</th><th>model</th><th>sampler draws from</th></tr></thead>
    <tbody>
      {s.candidates.map((c) => (
        <tr key={`${s.stats.generated}-${c.token}`} className={c.token === s.picked ? "is-diff" : undefined}>
          <td>{engine.show(c.token)}</td>
          <td>{Math.round(c.p * 100)}%<span className="ttlbar" style={{ transform: `scaleX(${c.p})` }} /></td>
          <td>{Math.round(c.q * 100)}%<span className="ttlbar" style={{ transform: `scaleX(${c.q})` }} /></td>
        </tr>
      ))}
    </tbody>
  </table>
);

export const LlmBench = () => {
  const { timeline, scenario, lesson, act, runScenario, reset } = useLlm();
  const frame = useTimelineFrame(timeline);
  const [selected, setSelected] = useState<LlmNodeId | null>(null);
  const present = timeline.present;
  const s = frame.state;

  return (
    <BenchFrame
      timeline={timeline}
      tabs={(Object.entries(SCENARIOS) as [ScenarioId, (typeof SCENARIOS)[ScenarioId]][]).map(([id, sc]) => ({ id, label: sc.label, title: sc.title }))}
      current={scenario}
      lesson={lesson}
      onTab={(id) => runScenario(id as ScenarioId)}
      onFirstSight={useCallback(() => runScenario("next"), [runScenario])}
      stage={<LiveDiagram timeline={timeline} frame={frame} nodes={nodesFor(frame, timeline.instant, selected)} edges={EDGES} layout={LAYOUT} heights={HEIGHTS} onSelect={(id) => setSelected(selected === id ? null : id as LlmNodeId)} />}
      inspect={selected && ROLES[selected]}
      caption={describe(frame)}
      speak={!timeline.running}
      position={(tl) => `step ${Math.max(0, tl.cursor - tl.traceStart + 1)}/${Math.max(0, tl.frames.length - tl.traceStart)}`}
      controls={<>
        <div className="control">
          <span className="label">Prompt</span>
          <button type="button" className="btn btn--solid btn--wide" id="prompt-capital" onClick={() => act(ACTIONS.submit("capital"))}>The capital of France is</button>
          <div className="control__row">
            <button type="button" className="btn" id="prompt-name" onClick={() => act(ACTIONS.submit("name"))}>What is my name?</button>
            <button type="button" className="btn" id="prompt-unknown" onClick={() => act(ACTIONS.submit("unknown"))}>Chess champion</button>
          </div>
        </div>
        <div className="control">
          <span className="label">Generate</span>
          <div className="control__row">
            <button type="button" className="btn" id="next-token" disabled={!present.prompt || present.done !== null} onClick={() => act(ACTIONS.step())}>One token</button>
            <button type="button" className="btn" id="finish" disabled={!present.prompt || present.done !== null} onClick={() => act(ACTIONS.complete())}>To the end</button>
          </div>
        </div>
        <div className="control">
          <span className="label">Sampling</span>
          <Segmented<Temperature> id="temperature" label="Temperature" value={present.temperature} options={[["0", "Temp 0"], ["0.8", "0.8"], ["1.5", "1.5"]]} onChange={(temperature) => act((st) => engine.configure(st, { temperature }))} />
          <Segmented<WindowSize> id="window" label="Context window" value={present.windowSize} options={[["16", "16 tokens"], ["64", "64 tokens"]]} onChange={(windowSize) => act((st) => engine.configure(st, { windowSize }))} />
          <button type="button" className="btn btn--wide" id="reset" onClick={reset}>Reset</button>
        </div>
      </>}
      readouts={
        <div className="readouts">
          <div className="readout">
            <div className="readout__h label"><span>The last forward pass</span><span>␣ marks a leading space</span></div>
            <div id="candidates"><Candidates s={s} /></div>
          </div>
          <div className="readout">
            <div className="readout__h label"><span>Counters</span></div>
            <div className="counters" id="counters">
              {counters(s).map(([k, name, value]) => <div className="counter" data-c={k} key={k}><b key={value}>{value}</b><span className="label">{name}</span></div>)}
            </div>
          </div>
        </div>
      }
      titleblock={["Sheet 07 · From prompt to next token", "A toy model with a tiny vocabulary", "Probabilities illustrative"]}
    />
  );
};
