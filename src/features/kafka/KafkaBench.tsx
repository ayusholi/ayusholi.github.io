"use client";

import { AnimatePresence, m } from "motion/react";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Caption } from "@/components/simulation/Caption";
import { SimulationControls } from "@/components/simulation/SimulationControls";
import { Segmented } from "@/components/ui/Segmented";
import { reducedMotion, transportKeys, useFirstSight, usePauseWhenHidden, useTimelineFrame } from "@/lib/simulation/useTimeline";
import { useKafka } from "./KafkaProvider";
import { CELL, cellX, KafkaTape } from "./KafkaTape";
import { describe } from "./kafka-content";
import * as engine from "./kafka-engine";
import { EXPERIMENTS, type ExperimentId } from "./kafka-scenarios";
import type { CommitMode, Consumer, KafkaState } from "./kafka-types";

const STATE_LABEL = { running: "● running", paused: "‖ paused", crashed: "✕ crashed" };
const STATS: [keyof KafkaState["stats"], string][] = [["delivered", "Delivered"], ["duplicates", "Duplicates"], ["lost", "Never processed"], ["outOfOrder", "Out of key order"]];
const COMMIT_SIZES = [["1", "1"], ["3", "3"], ["5", "5"]] as const;

type Flight = { el: HTMLElement; from: { x: number; y: number }; to: { x: number; y: number } };

const ConsumerCard = ({ c, owned, busy, onAction }: { c: Consumer; owned: string[]; busy: boolean; onAction: (a: "pause" | "resume" | "crash" | "remove", id: string) => void }) => {
  const idle = !owned.length && c.status === "running";
  const paused = c.status === "paused";
  return (
    <article className={`consumer is-${idle ? "idle" : c.status}${busy ? " is-busy" : ""}`} data-c={c.id}>
      <div className="consumer__h"><b>{c.id}</b><span className="consumer__state">{idle ? "○ idle" : STATE_LABEL[c.status]}</span></div>
      <div className="consumer__owns">{owned.length ? owned.join(" ") : "no partitions"}</div>
      <div className="consumer__acts">
        <button type="button" className="mini" data-do={paused ? "resume" : "pause"} aria-label={`${paused ? "Resume" : "Pause"} ${c.id}`} onClick={() => onAction(paused ? "resume" : "pause", c.id)}>{paused ? "Resume" : "Pause"}</button>
        <button type="button" className="mini" data-do="crash" aria-label={`Crash ${c.id}`} onClick={() => onAction("crash", c.id)}>Crash</button>
        <button type="button" className="mini" data-do="remove" aria-label={`Remove ${c.id}`} onClick={() => onAction("remove", c.id)}>Leave</button>
      </div>
    </article>
  );
};

export const KafkaBench = () => {
  const { timeline, experiment, lesson, auto, setAuto, act, runExperiment, freshTopic } = useKafka();
  const frame = useTimelineFrame(timeline);
  const bench = useRef<HTMLDivElement>(null);
  const yard = useRef<HTMLDivElement>(null);
  const wires = useRef<SVGSVGElement>(null);
  const flights = useRef<Flight[]>([]);
  const [freshSize, setFreshSize] = useState("3");
  const [seekPartition, setSeekPartition] = useState("0");
  const [seekOffset, setSeekOffset] = useState("0");
  usePauseWhenHidden(bench, timeline);
  useFirstSight(yard, useCallback(() => runExperiment("ordering"), [runExperiment]));

  const s = frame.state;
  const present = timeline.present;   // controls show the present, even while rewound
  const instant = timeline.instant;
  const packets = instant ? [] : frame.packets;
  const busy = packets.flatMap((p) => (p.kind === "consume" ? [p] : []));
  const incoming = !instant && frame.type === "record.produced" && !reducedMotion() ? frame.record ?? null : null;

  const relative = useCallback((el: Element) => {
    const a = el.getBoundingClientRect(), b = (yard.current as HTMLElement).getBoundingClientRect();
    return { x: a.left - b.left, y: a.top - b.top, w: a.width, h: a.height };
  }, []);

  // Curved wires from each tape to its owner, measured from the laid-out DOM.
  const drawWires = useCallback((state: KafkaState, busyParts: number[]) => {
    const svg = wires.current, root = yard.current;
    if (!svg || !root || getComputedStyle(svg).display === "none") return;
    const narrow = getComputedStyle(root).gridTemplateColumns.split(" ").length < 3;
    svg.innerHTML = narrow ? "" : state.partitions.map((p, i) => {
      const consumer = root.querySelector(`[data-c="${p.owner}"]`);
      const lagEl = root.querySelector(`[data-p="${i}"] + .tape__lag`);
      if (!consumer || !lagEl) return "";
      const a = relative(lagEl), b = relative(consumer);
      const x1 = a.x + a.w + 3, y1 = a.y + a.h / 2, x2 = b.x, y2 = b.y + b.h / 2, mid = (x1 + x2) / 2;
      return `<path class="${busyParts.includes(i) ? "is-busy" : ""}" d="M${x1} ${y1}C${mid} ${y1} ${mid} ${y2} ${x2} ${y2}"/>`;
    }).join("");
  }, [relative]);

  // Records in flight move on every animation frame, so they live outside React.
  useLayoutEffect(() => {
    const root = yard.current;
    drawWires(s, busy.map((p) => p.partition));
    if (!root || reducedMotion()) return;
    const made: Flight[] = [];
    packets.forEach((p) => {
      const track = root.querySelector<HTMLElement>(`[data-p="${p.partition}"]`);
      if (!track) return;
      const box = relative(track);
      const start = Number(track.dataset.start);
      const slot = (offset: number) => ({ x: box.x + cellX(offset) - start * CELL, y: box.y + 14 });
      let from, to;
      if (p.kind === "produce") {
        const src = relative(root.querySelector("#producer") as Element);
        from = { x: src.x + src.w - 40, y: src.y + 10 };
        to = slot(p.record.offset);
      } else {
        const card = root.querySelector(`[data-c="${p.consumer}"]`);
        if (!card) return;
        const dst = relative(card);
        from = slot(p.record.offset);
        from.x = Math.max(box.x, from.x);
        to = { x: dst.x + 10, y: dst.y + 10 };
      }
      // Stacked phone layout: the group is below, keep the flight on-screen.
      to.x = Math.min(to.x, root.clientWidth - 40);
      const el = document.createElement("span");
      el.className = `fly${p.kind === "consume" && p.duplicate ? " is-dup" : ""}`;
      el.textContent = p.record.id;
      root.appendChild(el);
      made.push({ el, from, to });
    });
    flights.current = made;
    return () => { made.forEach((f) => f.el.remove()); flights.current = []; };
    // `packets` and `busy` derive from frame and instant
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [frame, instant, drawWires, relative]);

  useEffect(() => timeline.onProgress((t, current) => {
    const k = 1 - Math.pow(1 - t, 3);
    flights.current.forEach(({ el, from, to }) => {
      el.style.transform = `translate(${from.x + (to.x - from.x) * k}px, ${from.y + (to.y - from.y) * k}px)`;
      el.style.opacity = t >= 1 ? "0" : "1";
    });
    if (t >= 1 && current.record) {
      yard.current?.querySelector(`[data-p="${current.record.partition}"] [data-offset="${current.record.offset}"]`)?.classList.remove("is-incoming");
    }
  }), [timeline]);

  useEffect(() => {
    const root = yard.current;
    if (!root) return;
    const observer = new ResizeObserver(() => drawWires(timeline.frame.state, []));
    observer.observe(root);
    return () => observer.disconnect();
  }, [drawWires, timeline]);

  const onConsumer = (action: "pause" | "resume" | "crash" | "remove", id: string) => {
    const run = { pause: engine.pauseConsumer, resume: engine.resumeConsumer, crash: engine.crashConsumer, remove: engine.removeConsumer }[action];
    act((state) => run(state, id));
  };
  const onSeek = useCallback((partition: number, offset: number) => act((state) => engine.seek(state, partition, offset)), [act]);

  const [title, text] = describe(frame);
  const counters = [
    ...STATS.map(([k, name]) => [k, name, s.stats[k]] as const),
    ["lag", "Total lag", engine.totalLag(s)] as const,
    ["active", "Active consumers", engine.activeConsumers(s)] as const,
    ["generation", "Generation", s.generation] as const,
  ];

  return (
    <div className="bench sheet" id="bench" ref={bench} onKeyDown={transportKeys(timeline)}>
      <div className="tabs" id="tabs" role="group" aria-label="Experiments">
        {(Object.entries(EXPERIMENTS) as [ExperimentId, (typeof EXPERIMENTS)[ExperimentId]][]).map(([id, x]) => (
          <button key={id} type="button" className="tab" data-value={id} aria-pressed={experiment === id} onClick={() => runExperiment(id)}>
            <span className="label">{x.label}</span><b>{x.title}</b>
          </button>
        ))}
      </div>
      <p className="lesson" id="lesson">{lesson}</p>

      <div className="yard" id="yard" ref={yard}>
        <svg className="yard__wires" ref={wires} aria-hidden="true" />
        <AnimatePresence>
          {s.rebalancing > 0 && (
            <m.p className="rebalance" id="banner" initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }}>
              Rebalancing · generation {s.generation}
            </m.p>
          )}
        </AnimatePresence>

        <div className="yard__col">
          <div className="yard__h label">Producer</div>
          <div className="producer" id="producer">
            <b>orders-api</b>
            <button type="button" className="btn btn--solid btn--wide" id="send" onClick={() => act((st) => engine.produce(st))}>Send record</button>
            <button type="button" className="btn btn--wide" id="send-10" onClick={() => act((st) => engine.produceMany(st, 10))}>Send 10</button>
            <span className="label">Keep sending</span>
            <Segmented id="auto" label="Keep sending" value={auto ? "on" : "off"} options={[["off", "Off"], ["on", "On"]]} onChange={(v) => setAuto(v === "on")} />
            <span className="label">Use keys</span>
            <Segmented id="keys" label="Use keys" value={present.keyed ? "on" : "off"} options={[["on", "A B C"], ["off", "None"]]} onChange={(v) => act((st) => engine.configure(st, { keyed: v === "on" }))} />
          </div>
        </div>

        <div className="yard__col">
          <div className="yard__h label">Topic: orders · each cell is record, offset</div>
          <div id="tapes">
            {s.partitions.map((p, i) => <KafkaTape key={i} partition={p} index={i} incoming={incoming?.partition === i ? incoming.offset : null} onSeek={onSeek} />)}
          </div>
        </div>

        <div className="yard__col yard__col--group">
          <div className="yard__h label">Consumer group: demo</div>
          <div className="yard__col yard__list" id="consumers">
            {s.consumers.map((c) => (
              <ConsumerCard key={c.id} c={c} owned={s.partitions.flatMap((p, i) => (p.owner === c.id ? [`P${i}`] : []))} busy={busy.some((p) => p.consumer === c.id)} onAction={onConsumer} />
            ))}
            {!s.consumers.length && <p className="control__hint">No consumers. Records wait on the log, safely, until someone reads them.</p>}
          </div>
        </div>
      </div>

      <Caption id="caption" title={title} text={text} />
      <p className="sr" id="status" role="status">{timeline.running ? "" : `${title}. ${text}`}</p>
      <div className="transport-bar">
        <SimulationControls timeline={timeline} label={(tl) => `tick ${tl.frame.state.tick}`} onRestart={() => experiment && runExperiment(experiment)} />
      </div>

      <div className="sinkrow">
        <div className="readout__h label"><span>What the application did, in order</span><span>dashed = duplicate · filled = out of key order</span></div>
        <div className="sink" id="sink">
          {s.applied.slice(-22).map((a, i) => {
            const said = a.skipped ? "skipped duplicate" : a.duplicate ? "duplicate" : a.outOfOrder ? "out of key order" : undefined;
            return <i key={i} className={`${a.duplicate ? "is-dup " : ""}${a.skipped ? "is-skip " : ""}${a.outOfOrder ? "is-late" : ""}`} title={said}>{a.id}</i>;
          })}
        </div>
        <div className="counters counters--wide" id="stats">
          {counters.map(([k, name, value]) => <div className="counter" data-s={k} key={k}><b key={value}>{value}</b><span className="label">{name}</span></div>)}
        </div>
      </div>

      <div className="kcontrols" aria-label="Experiment">
        <div className="control">
          <span className="label">Topic</span>
          <button type="button" className="btn" id="add-part" disabled={present.partitions.length >= engine.MAX_PARTITIONS} onClick={() => act(engine.addPartition)}>+ Partition ({present.partitions.length}/{engine.MAX_PARTITIONS})</button>
          <div className="seekform">
            <label className="label" htmlFor="fresh-n">New topic with</label>
            <select id="fresh-n" value={freshSize} onChange={(e) => setFreshSize(e.target.value)}>
              {[1, 2, 3, 4, 6, 8].map((n) => <option key={n}>{n}</option>)}
            </select>
            <button type="button" className="btn" id="fresh" onClick={() => freshTopic(Number(freshSize))}>Start over</button>
          </div>
        </div>
        <div className="control">
          <span className="label">Group</span>
          <button type="button" className="btn" id="add-cons" disabled={present.consumers.length >= engine.MAX_CONSUMERS} onClick={() => act(engine.addConsumer)}>+ Consumer ({present.consumers.length}/{engine.MAX_CONSUMERS})</button>
          <span className="control__hint">Pause, crash or stop consumers on their own cards.</span>
        </div>
        <div className="control">
          <span className="label">Records per poll, then commit</span>
          <Segmented id="commit-every" label="Records per poll" value={String(present.commitEvery) as "1" | "3" | "5"} options={COMMIT_SIZES} onChange={(v) => act((st) => engine.configure(st, { commitEvery: Number(v) }))} />
          <span className="label">Commit</span>
          <Segmented<CommitMode> id="commit-mode" label="Commit" value={present.commitMode} options={[["after", "After processing"], ["before", "Before"]]} onChange={(commitMode) => act((st) => engine.configure(st, { commitMode }))} />
          <span className="label">Idempotent application</span>
          <Segmented id="sink-mode" label="Idempotent application" value={present.idempotent ? "on" : "off"} options={[["off", "Off"], ["on", "On"]]} onChange={(v) => act((st) => engine.configure(st, { idempotent: v === "on" }))} />
        </div>
        <div className="control">
          <span className="label">Restart from an offset</span>
          <form className="seekform" id="seek-form" onSubmit={(e) => { e.preventDefault(); onSeek(Number(seekPartition), Number(seekOffset)); }}>
            <select id="seek-p" aria-label="Partition" value={seekPartition} onChange={(e) => setSeekPartition(e.target.value)}>
              {present.partitions.map((_, i) => <option key={i} value={i}>P{i}</option>)}
            </select>
            <input id="seek-o" type="number" min="0" aria-label="Offset" value={seekOffset} onChange={(e) => setSeekOffset(e.target.value)} />
            <button type="submit" className="btn">Seek</button>
          </form>
          <span className="control__hint">Or click any record on a tape.</span>
        </div>
      </div>

      <div className="titleblock label">
        <span><b>Sheet 02</b> · Topic, partitions, consumer group</span>
        <span>Single broker view, no replication</span>
        <span>Ticks are not real time</span>
      </div>
    </div>
  );
};

