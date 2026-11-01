// The Kafka topic page. Tapes are plain DOM, keyed by offset, and they only
// ever draw what the current frame's state says.
import { Timeline } from "../js/core/timeline.js";
import { createTransport } from "../js/core/transport.js";
import { createChallenge } from "../js/core/challenge.js";
import { $, escapeHtml, setText, segmented, onSegment, pauseWhenHidden, transportKeys, reducedMotion } from "../js/core/dom.js";
import { describe, cliTable, EXPERIMENTS } from "./content.js";
import * as sim from "./sim.js";

const CELL = 40;   // record width plus gap, in px
const bench = $("#bench"), yard = $("#yard");
const els = {
  tapes: $("#tapes"), consumers: $("#consumers"), wires: $("#wires"), caption: $("#caption"), lesson: $("#lesson"), sink: $("#sink"),
  status: $("#status"), banner: $("#banner"), cli: $("#cli"), seekP: $("#seek-p"), seekO: $("#seek-o"),
};

// ---------- Tapes ----------
const tapes = [];
const makeTape = (i) => {
  const root = document.createElement("div");
  root.className = "tape";
  root.innerHTML = `<span class="tape__name">P${i}</span>
    <div class="tape__track" data-p="${i}"><div class="tape__strip"><span class="commit-mark"></span><span class="cursor"><span></span></span></div></div>
    <span class="tape__lag"><b>0</b><br>lag</span>`;
  els.tapes.appendChild(root);
  const strip = $(".tape__strip", root);
  return { root, track: $(".tape__track", root), strip, cursor: $(".cursor", root), commit: $(".commit-mark", root), lagEl: $(".tape__lag", root), cells: new Map(), behind: null };
};

const tapeWindow = (tape, length) => {
  const visible = Math.max(3, Math.floor(tape.track.clientWidth / CELL));
  return Math.max(0, length + 1 - visible);
};
const cellX = (offset) => offset * CELL + 2;

const renderTape = (tape, p, index, incoming) => {
  const records = p.records;
  // Keyed: keep existing cells, add what's new, drop what a rewind removed.
  for (const [offset, el] of tape.cells) if (offset >= records.length) { el.remove(); tape.cells.delete(offset); }
  records.forEach((r) => {
    let el = tape.cells.get(r.offset);
    if (!el) {
      el = document.createElement("button");
      el.type = "button";
      el.tabIndex = -1;   // the seek form below is the keyboard route
      el.dataset.offset = r.offset;
      el.style.left = `${cellX(r.offset)}px`;
      el.title = `Rewind P${index} to offset ${r.offset}`;
      tape.strip.appendChild(el);
      tape.cells.set(r.offset, el);
    }
    // An offset can hold a different record after a reset, so check every time.
    if (el.dataset.record !== r.id) {
      el.dataset.record = r.id;
      el.innerHTML = `${r.id}<small>${r.offset}</small>`;
    }
    const cls = `rec${r.offset < p.committed ? " is-committed" : r.offset < p.position ? " is-read" : ""}${incoming === r.offset ? " is-incoming" : ""}`;
    if (el.className !== cls) el.className = cls;
  });
  const start = tapeWindow(tape, records.length);
  tape.start = start;
  tape.strip.style.transform = `translateX(${-start * CELL}px)`;
  tape.commit.style.transform = `translateX(${cellX(p.committed) - 2}px)`;
  tape.cursor.style.transform = `translateX(${cellX(p.position) - 2}px)`;
  setText(tape.cursor.firstElementChild, p.owner || "–");
  tape.root.classList.toggle("is-orphan", !p.owner);

  const n = sim.lag(p);
  setText(tape.lagEl.firstElementChild, n);
  tape.lagEl.classList.toggle("is-high", n >= 8);

  // The cursor can fall off the left of the tape; say so instead of hiding it.
  const behind = start - p.position;
  if (behind > 0 && !tape.behind) {
    tape.behind = document.createElement("span");
    tape.behind.className = "tape__behind";
    tape.track.appendChild(tape.behind);
  }
  if (tape.behind) {
    tape.behind.hidden = behind <= 0;
    if (behind > 0) setText(tape.behind, `◂ ${p.owner || "group"} ${behind} back`);
  }
};

// ---------- Consumers ----------
const STATE_LABEL = { running: "● running", paused: "‖ paused", crashed: "✕ crashed" };

const renderConsumers = (s, busy) => {
  const owned = (id) => s.partitions.flatMap((p, i) => (p.owner === id ? [`P${i}`] : []));
  const sig = JSON.stringify(s.consumers.map((c) => [c.id, c.status, owned(c.id)]));
  if (sig !== renderConsumers.sig) {
    renderConsumers.sig = sig;
    els.consumers.innerHTML = s.consumers.map((c) => {
      const parts = owned(c.id);
      const idle = !parts.length && c.status === "running";
      return `<article class="consumer is-${idle ? "idle" : c.status}" data-c="${c.id}">
        <div class="consumer__h"><b>${c.id}</b><span class="consumer__state">${idle ? "○ idle" : STATE_LABEL[c.status]}</span></div>
        <div class="consumer__owns">${parts.length ? parts.join(" ") : "no partitions"}</div>
        <div class="consumer__acts">
          <button type="button" class="mini" data-do="${c.status === "paused" ? "resume" : "pause"}" data-id="${c.id}" aria-label="${c.status === "paused" ? "Resume" : "Pause"} ${c.id}">${c.status === "paused" ? "Resume" : "Pause"}</button>
          <button type="button" class="mini" data-do="crash" data-id="${c.id}" aria-label="Crash ${c.id}">Crash</button>
          <button type="button" class="mini" data-do="remove" data-id="${c.id}" aria-label="Remove ${c.id}">Leave</button>
        </div>
      </article>`;
    }).join("") || `<p class="control__hint">No consumers. Records wait on the log, safely, until someone reads them.</p>`;
  }
  els.consumers.querySelectorAll(".consumer").forEach((el) => el.classList.toggle("is-busy", busy.includes(el.dataset.c)));
};

// ---------- Wires: each partition to its owner ----------
const relative = (el) => {
  const a = el.getBoundingClientRect(), b = yard.getBoundingClientRect();
  return { x: a.left - b.left, y: a.top - b.top, w: a.width, h: a.height };
};
const renderWires = (s, busyParts) => {
  if (getComputedStyle(els.wires).display === "none") return;
  const narrow = getComputedStyle(yard).gridTemplateColumns.split(" ").length < 3;
  els.wires.innerHTML = narrow ? "" : s.partitions.map((p, i) => {
    const consumer = els.consumers.querySelector(`[data-c="${p.owner}"]`);
    if (!consumer) return "";
    const a = relative(tapes[i].lagEl), b = relative(consumer);
    const x1 = a.x + a.w + 3, y1 = a.y + a.h / 2, x2 = b.x, y2 = b.y + b.h / 2, mid = (x1 + x2) / 2;
    return `<path class="${busyParts.includes(i) ? "is-busy" : ""}" d="M${x1} ${y1}C${mid} ${y1} ${mid} ${y2} ${x2} ${y2}"/>`;
  }).join("");
};

// ---------- Moving records ----------
let flying = [];
const clearFlying = () => { flying.forEach((f) => f.el.remove()); flying = []; };

const launch = (frame) => {
  clearFlying();
  if (reducedMotion()) return;
  const yardBox = yard.getBoundingClientRect();
  (frame.packets || []).forEach((p) => {
    const tape = tapes[p.partition];
    if (!tape) return;
    const track = relative(tape.track);
    const slot = (offset) => ({ x: track.x + cellX(offset) - tape.start * CELL, y: track.y + 14 });
    let from, to;
    if (p.kind === "produce") {
      const src = relative($("#producer"));
      from = { x: src.x + src.w - 40, y: src.y + 10 };
      to = slot(p.record.offset);
    } else {
      const c = els.consumers.querySelector(`[data-c="${p.consumer}"]`);
      if (!c) return;
      const dst = relative(c);
      from = slot(p.record.offset);
      from.x = Math.max(track.x, from.x);
      to = { x: dst.x + 10, y: dst.y + 10 };
    }
    // Stacked phone layout: the group is below, keep the flight on-screen.
    to.x = Math.min(to.x, yardBox.width - 40);
    const el = document.createElement("span");
    el.className = `fly${p.duplicate ? " is-dup" : ""}`;
    el.textContent = p.record.id;
    yard.appendChild(el);
    flying.push({ el, from, to });
  });
};

const ease = (t) => 1 - Math.pow(1 - t, 3);

// ---------- Sink, stats, CLI ----------
const STATS = [["delivered", "Delivered"], ["duplicates", "Duplicates"], ["lost", "Never processed"], ["outOfOrder", "Out of key order"]];
$("#stats").innerHTML = [...STATS.map(([k, n]) => `<div class="counter" data-s="${k}"><b>0</b><span class="label">${n}</span></div>`),
  `<div class="counter" data-s="lag"><b>0</b><span class="label">Total lag</span></div>`,
  `<div class="counter" data-s="active"><b>0</b><span class="label">Active consumers</span></div>`,
  `<div class="counter" data-s="generation"><b>1</b><span class="label">Generation</span></div>`].join("");

const renderReadouts = (s) => {
  const values = { ...s.stats, lag: sim.totalLag(s), active: sim.activeConsumers(s), generation: s.generation };
  Object.entries(values).forEach(([k, v]) => setText($(`[data-s="${k}"] b`), v));
  els.sink.innerHTML = s.applied.slice(-22).map((a) => {
    const cls = `${a.duplicate ? "is-dup" : ""} ${a.skipped ? "is-skip" : ""} ${a.outOfOrder ? "is-late" : ""}`;
    const said = a.skipped ? "skipped duplicate" : a.duplicate ? "duplicate" : a.outOfOrder ? "out of key order" : "";
    return `<i class="${cls}"${said ? ` title="${said}"` : ""}>${a.id}</i>`;
  }).join("");
  const t = cliTable(s);
  els.cli.innerHTML = `<span class="dim">$ kafka-consumer-groups --describe --group demo</span>\n\n${escapeHtml(t.head)}\n${t.rows.map(escapeHtml).join("\n")}`;
  segmented($("#commit-every"), s.commitEvery);
  segmented($("#commit-mode"), s.commitMode);
  segmented($("#sink-mode"), s.idempotent ? "on" : "off");
  segmented($("#keys"), s.keyed ? "on" : "off");
  $("#add-part").textContent = `+ Partition (${s.partitions.length}/${sim.MAX_PARTITIONS})`;
  $("#add-part").disabled = s.partitions.length >= sim.MAX_PARTITIONS;
  $("#add-cons").textContent = `+ Consumer (${s.consumers.length}/${sim.MAX_CONSUMERS})`;
  $("#add-cons").disabled = s.consumers.length >= sim.MAX_CONSUMERS;
  if (els.seekP.options.length !== s.partitions.length) {
    els.seekP.innerHTML = s.partitions.map((_, i) => `<option value="${i}">P${i}</option>`).join("");
  }
};

// ---------- One frame ----------
const onFrame = (frame, { instant }) => {
  const s = frame.state;
  while (tapes.length < s.partitions.length) tapes.push(makeTape(tapes.length));
  while (tapes.length > s.partitions.length) tapes.pop().root.remove();
  const incoming = !instant && frame.type === "record.produced" && !reducedMotion() ? frame.record : null;
  s.partitions.forEach((p, i) => renderTape(tapes[i], p, i, incoming?.partition === i ? incoming.offset : null));

  const packets = instant ? [] : frame.packets || [];
  const busy = packets.filter((p) => p.kind === "consume");
  renderConsumers(s, busy.map((p) => p.consumer));
  renderWires(s, busy.map((p) => p.partition));
  renderReadouts(s);

  els.banner.hidden = !s.rebalancing;
  if (s.rebalancing) setText(els.banner, `Rebalancing · generation ${s.generation}`);

  const [title, text] = describe(frame);
  els.caption.innerHTML = `<strong class="caption__t">${escapeHtml(title)}</strong><span class="caption__d">${escapeHtml(text)}</span>`;
  if (!timeline?.running) els.status.textContent = `${title}. ${text}`;
  if (instant) clearFlying(); else launch(frame);
};

const onProgress = (frame, t) => {
  const k = ease(t);
  flying.forEach(({ el, from, to }) => {
    el.style.transform = `translate(${from.x + (to.x - from.x) * k}px, ${from.y + (to.y - from.y) * k}px)`;
    el.style.opacity = t >= 1 ? 0 : 1;
  });
  if (t >= 1) {
    clearFlying();
    if (frame.type === "record.produced") tapes[frame.record.partition]?.cells.get(frame.record.offset)?.classList.remove("is-incoming");
  }
};

// ---------- Timeline ----------
// Auto-produce is a visitor setting, not part of the topic's state.
let auto = false, autoBeat = 0;
const generate = (state) => {
  if (auto && autoBeat++ % 2 === 0) return sim.produce(state);
  return sim.tick(state);
};

let timeline = null;
timeline = new Timeline({
  initial: { type: "ready", state: sim.createState(), packets: [], dur: 1 },
  onFrame, onProgress, generate,
  onChange: () => transport.update(),
});
const transport = createTransport($("#transport"), timeline, {
  label: (tl) => `tick ${tl.frame.state.tick}`,
  onRestart: () => runExperiment(current),
});
pauseWhenHidden(bench, timeline);
transportKeys(bench, timeline);

// Every action applies to the present, and goes on screen at once when paused.
const act = (fn) => {
  const frames = fn(timeline.present);
  if (frames?.length) timeline.push(frames, { animate: timeline.running, restart: false });
};

// ---------- Experiments ----------
let current = "ordering";
const tabs = $("#tabs");
tabs.innerHTML = Object.entries(EXPERIMENTS).map(([id, x]) => `<button type="button" class="tab" data-value="${id}" aria-pressed="false"><span class="label">${x.label}</span><b>${x.title}</b></button>`).join("");

const buildExperiment = (x) => {
  let s = sim.createState(x.options);
  if (x.pause) s = sim.lastState(sim.pauseConsumer(s, x.pause), s);
  s = sim.repeat(s, sim.produce, x.records);
  if (x.ticks) s = sim.ticks(s, x.ticks);
  if (x.crash) {
    // Crash whichever consumer is really mid-batch, so the lesson always shows.
    const target = s.partitions.find((p) => p.position > p.committed && p.owner)?.owner || x.crash;
    s = sim.lastState(sim.crashConsumer(s, target), s);
  }
  if (x.drain) s = sim.drain(s);
  return s;
};

const runExperiment = (id) => {
  current = id;
  auto = false;
  segmented($("#auto"), "off");
  segmented(tabs, id);
  els.lesson.textContent = EXPERIMENTS[id].lesson;
  timeline.reset({ type: "ready", state: buildExperiment(EXPERIMENTS[id]), packets: [], dur: 1 });
  timeline.play();
};
onSegment(tabs, runExperiment);

// ---------- Controls ----------
$("#send").addEventListener("click", () => act((s) => sim.produce(s)));
$("#send-10").addEventListener("click", () => act((s) => sim.produceMany(s, 10)));
onSegment($("#auto"), (v) => { auto = v === "on"; segmented($("#auto"), v); if (auto) timeline.play(); });
onSegment($("#keys"), (v) => act((s) => sim.configure(s, { keyed: v === "on" })));
onSegment($("#commit-every"), (v) => act((s) => sim.configure(s, { commitEvery: Number(v) })));
onSegment($("#commit-mode"), (v) => act((s) => sim.configure(s, { commitMode: v })));
onSegment($("#sink-mode"), (v) => act((s) => sim.configure(s, { idempotent: v === "on" })));
$("#add-part").addEventListener("click", () => act(sim.addPartition));
$("#add-cons").addEventListener("click", () => act(sim.addConsumer));
$("#fresh").addEventListener("click", () => {
  const n = Number($("#fresh-n").value);
  segmented(tabs, "");
  els.lesson.textContent = `A new topic with ${n} partition${n === 1 ? "" : "s"}. A live topic can't shrink, so going down means starting again.`;
  auto = false;
  segmented($("#auto"), "off");
  timeline.reset({ type: "ready", state: sim.createState({ partitions: n, consumers: 2 }), packets: [], dur: 1 });
  timeline.play();
});

els.consumers.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-do]");
  if (!btn) return;
  const id = btn.dataset.id;
  const run = { pause: sim.pauseConsumer, resume: sim.resumeConsumer, crash: sim.crashConsumer, remove: sim.removeConsumer }[btn.dataset.do];
  act((s) => run(s, id));
});

els.tapes.addEventListener("click", (e) => {
  const rec = e.target.closest(".rec");
  if (rec) act((s) => sim.seek(s, Number(rec.closest("[data-p]").dataset.p), Number(rec.dataset.offset)));
});
$("#seek-form").addEventListener("submit", (e) => {
  e.preventDefault();
  act((s) => sim.seek(s, Number(els.seekP.value), Number(els.seekO.value)));
});

new ResizeObserver(() => {
  const f = timeline.frame;
  f.state.partitions.forEach((p, i) => tapes[i] && renderTape(tapes[i], p, i, null));
  renderWires(f.state, []);
}).observe(yard);

// ---------- Challenges: answered by the simulation ----------
createChallenge($("#challenge"), {
  question: "A topic has six partitions. A group has eight consumers. How many can actively consume this topic at the same time?",
  options: ["Eight. Partitions are shared between them.", "Six. The other two stay idle.", "One. Only the group leader reads.", "Four. Kafka keeps spares in reserve."],
  answer: 1,
  verdict: () => {
    const s = sim.createState({ partitions: 6, consumers: 8 });
    return `In the simulation, ${sim.activeConsumers(s)} of ${s.consumers.length} consumers end up with a partition. Each partition has at most one owner in a group, so the partition count caps parallelism. The two spares aren't useless: they take over when an active member fails.`;
  },
});
createChallenge($("#challenge-2"), {
  question: "Records A1 and B1 land in different partitions, with A1 written first. In what order will a consumer group process them?",
  options: ["A1 then B1, because A1 has the earlier timestamp.", "B1 then A1, because the newest record goes first.", "Either order. Kafka only orders records within a partition."],
  answer: 2,
  verdict: () => "Offsets are per partition, so there's no number that compares A1 with B1. If two events must stay in order, give them the same key so they share a partition.",
});

// ---------- First paint ----------
onFrame(timeline.frame, { instant: true });
transport.update();
segmented(tabs, current);
els.lesson.textContent = EXPERIMENTS[current].lesson;
new IntersectionObserver(([entry], io) => {
  if (!entry.isIntersecting) return;
  io.disconnect();
  runExperiment(current);
}, { threshold: 0.3 }).observe(yard);
