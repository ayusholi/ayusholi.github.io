"use client";

import { useCallback, useState } from "react";
import { BenchFrame } from "@/components/simulation/BenchFrame";
import { LiveDiagram } from "@/components/simulation/LiveDiagram";
import type { DiagramLayout, DiagramNode } from "@/components/simulation/SystemDiagram";
import { Segmented } from "@/components/ui/Segmented";
import { useTimelineFrame } from "@/lib/simulation/useTimeline";
import { useReminders } from "./RemindersProvider";
import { describe, ROLES } from "./reminders-content";
import * as engine from "./reminders-engine";
import { ACTIONS, SCENARIOS, type ScenarioId } from "./reminders-scenarios";
import type { RemFrame, RemNodeId, RemState, Template, Tz } from "./reminders-types";

const IDS: RemNodeId[] = ["phone", "whatsapp", "server", "ai", "db", "scheduler"];
const EDGES: [RemNodeId, RemNodeId][] = [["phone", "whatsapp"], ["whatsapp", "server"], ["server", "ai"], ["server", "db"], ["scheduler", "db"], ["scheduler", "whatsapp"]];
const LAYOUT: DiagramLayout = (w) => (w < 620
  ? { height: 420, at: { phone: [0.25, 50], ai: [0.75, 50], whatsapp: [0.25, 200], server: [0.75, 200], scheduler: [0.25, 360], db: [0.75, 360] } }
  : { height: 380, at: { phone: [0.08, 190], whatsapp: [0.32, 190], ai: [0.6, 65], server: [0.6, 190], scheduler: [0.6, 315], db: [0.88, 190] } });
const HEIGHTS = { wide: 380, narrow: 420 };

const counters = (s: RemState) => [
  ["messagesIn", "Messages in", s.stats.messagesIn], ["aiCalls", "AI calls", s.stats.aiCalls], ["saved", "Reminders saved", s.stats.saved],
  ["delivered", "Delivered", s.stats.delivered], ["rejected", "Not delivered", s.stats.rejected], ["questions", "Questions asked", s.stats.questions],
] as const;

const nodesFor = (frame: RemFrame, instant: boolean, selected: string | null): DiagramNode[] => {
  const s = frame.state;
  return IDS.map((id) => {
    const role = ROLES[id];
    const node: DiagramNode = { id, name: role.name, sub: role.sub, ariaLabel: `${role.name}: ${role.sub}. Inspect`, active: frame.at === id && !instant, selected: selected === id };
    if (id === "phone" && s.lastIn !== null) node.tag = engine.inWindow(s, s.now) ? "window open" : "window closed";
    if (id === "whatsapp") node.down = frame.type === "rejected";
    if (id === "ai") {
      node.sub = s.tz === "user" ? "Told: Asia/Kathmandu" : "Told: UTC";
      if (s.parsed) node.tag = s.parsed.at ? `at ${s.parsed.at.slice(11)}` : "at: null";
    }
    if (id === "db") {
      const waiting = s.reminders.filter((r) => r.status === "scheduled").length;
      if (s.reminders.length) node.tag = `${waiting} scheduled`;
    }
    if (id === "scheduler") node.tag = engine.when(s.now);
    if (id === "server") node.sub = s.template === "on" ? `Template: ${engine.TEMPLATE}` : "No template";
    return node;
  });
};

const Reminders = ({ s }: { s: RemState }) => (
  <table className="keys mono">
    <thead><tr><th>#</th><th>task</th><th>due</th><th>repeat</th><th>sent / failed</th></tr></thead>
    <tbody>
      {[...s.reminders].reverse().map((r) => (
        <tr key={r.id} className={r.status === "done" ? "is-ghost" : undefined}>
          <td>{r.id}</td><td>{r.task}</td>
          <td title={r.due !== r.intended ? `meant ${engine.clock(r.intended)}` : undefined}>{r.status === "done" ? "done" : engine.when(r.due)}{r.due !== r.intended ? " ✕" : ""}</td>
          <td>{r.repeat ?? "–"}</td><td>{r.delivered} / {r.rejected}</td>
        </tr>
      ))}
    </tbody>
  </table>
);

export const RemindersBench = () => {
  const { timeline, scenario, lesson, act, runScenario, reset } = useReminders();
  const frame = useTimelineFrame(timeline);
  const [selected, setSelected] = useState<RemNodeId | null>(null);
  const present = timeline.present;
  const s = frame.state;
  const nextDue = present.reminders.filter((r) => r.status === "scheduled").sort((a, b) => a.due - b.due)[0];

  return (
    <BenchFrame
      timeline={timeline}
      tabs={(Object.entries(SCENARIOS) as [ScenarioId, (typeof SCENARIOS)[ScenarioId]][]).map(([id, sc]) => ({ id, label: sc.label, title: sc.title }))}
      current={scenario}
      lesson={lesson}
      onTab={(id) => runScenario(id as ScenarioId)}
      onFirstSight={useCallback(() => runScenario("one"), [runScenario])}
      stage={<LiveDiagram timeline={timeline} frame={frame} nodes={nodesFor(frame, timeline.instant, selected)} edges={EDGES} layout={LAYOUT} heights={HEIGHTS} onSelect={(id) => setSelected(selected === id ? null : id as RemNodeId)} />}
      inspect={selected && ROLES[selected]}
      caption={describe(frame)}
      speak={!timeline.running}
      position={(tl) => `step ${Math.max(0, tl.cursor - tl.traceStart + 1)}/${Math.max(0, tl.frames.length - tl.traceStart)}`}
      controls={<>
        <div className="control">
          <span className="label">Message the bot</span>
          <button type="button" className="btn btn--solid btn--wide" id="msg-rent" onClick={() => act(ACTIONS.send("rent"))}>Pay rent tomorrow at 9</button>
          <button type="button" className="btn btn--wide" id="msg-pills" onClick={() => act(ACTIONS.send("pills"))}>Medicine every day at 8pm</button>
          <button type="button" className="btn btn--wide" id="msg-later" onClick={() => act(ACTIONS.send("later"))}>The meeting, later</button>
        </div>
        <div className="control">
          <span className="label">Settings</span>
          <Segmented<Tz> id="tz" label="Timezone in the prompt" value={present.tz} options={[["user", "User's zone"], ["server", "Server's UTC"]]} onChange={(tz) => act((st) => engine.configure(st, { tz }))} />
          <Segmented<Template> id="template" label="Template outside the window" value={present.template} options={[["off", "No template"], ["on", "Approved template"]]} onChange={(template) => act((st) => engine.configure(st, { template }))} />
        </div>
        <div className="control">
          <span className="label">Clock</span>
          <button type="button" className="btn btn--wide" id="advance" disabled={!nextDue} onClick={() => act(ACTIONS.advance())}>{nextDue ? `Skip to ${engine.when(nextDue.due)}` : "Nothing scheduled"}</button>
          <button type="button" className="btn btn--wide" id="reset" onClick={reset}>Reset</button>
        </div>
      </>}
      readouts={
        <div className="readouts">
          <div className="readout">
            <div className="readout__h label"><span>Reminders, newest first</span><span>✕ not the time asked for</span></div>
            <div id="reminders"><Reminders s={s} /></div>
          </div>
          <div className="readout">
            <div className="readout__h label"><span>Counters</span></div>
            <div className="counters" id="counters">
              {counters(s).map(([k, name, value]) => <div className="counter" data-c={k} key={k}><b key={value}>{value}</b><span className="label">{name}</span></div>)}
            </div>
          </div>
        </div>
      }
      titleblock={["Sheet 13 · From a chat message to a reminder", "One user, in Kathmandu", "The clock skips ahead to each reminder"]}
    />
  );
};
