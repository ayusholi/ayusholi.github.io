// The Redis topic page: wires the simulation, timeline and panels together.
import { Timeline } from "../js/core/timeline.js";
import { createTransport } from "../js/core/transport.js";
import { createChallenge } from "../js/core/challenge.js";
import { $, $$, escapeHtml, setText, segmented, onSegment, pauseWhenHidden, transportKeys, reducedMotion } from "../js/core/dom.js";
import { createSchematic, renderStrips, STRIP_KEY } from "./schematic.js";
import { describe, ROLES, SCENARIOS, CODE_LINES } from "./content.js";
import * as sim from "./sim.js";

const bench = $("#bench");
const els = {
  caption: $("#caption"), lesson: $("#lesson"), strips: $("#strips"), keys: $("#keyspace"), rows: $("#rows"),
  counters: $("#counters"), log: $("#wirelog"), now: $("#clock"), status: $("#status"), ttl: $("#ttl"), ttlOut: $("#ttl-out"),
  down: $("#toggle-redis"), code: $("#code"), inspector: $("#inspect"),
};
$("#strip-key").innerHTML = STRIP_KEY;

// ---------- Rendering: everything below reads one frame's state ----------
const schematic = createSchematic($("#stage"), {
  onInspect: (id) => {
    els.inspector.hidden = !id;
    if (id) els.inspector.innerHTML = `<p class="label">Inspecting</p><h3>${ROLES[id].name}</h3><p>${ROLES[id].role}</p>`;
  },
});

const COUNTERS = [["requests", "Requests"], ["hits", "Hits"], ["misses", "Misses"], ["dbQueries", "DB queries"], ["stale", "Stale reads"], ["failed", "Failed"]];
els.counters.innerHTML = COUNTERS.map(([k, name]) => `<div class="counter" data-c="${k}"><b>0</b><span class="label">${name}</span></div>`).join("");
const codeLines = $$(".ln", els.code);

const show = (s) => JSON.stringify({ name: s.name, plan: s.plan });
let lastKeys = "";

const renderState = (s) => {
  const keys = Object.entries(s.cache);
  const sig = keys.map(([k, e]) => k + e.storedAt).join();
  const fresh = sig !== lastKeys;
  lastKeys = sig;
  els.keys.innerHTML = keys.length
    ? `<table class="keys mono"><thead><tr><th>key</th><th>value</th><th>ttl</th></tr></thead><tbody>${keys.map(([k, e]) => {
      const live = sim.isLive(e, s.now);
      const left = sim.ttlLeft(e, s.now), total = (e.expiresAt - e.storedAt) / 1000;
      const stale = live && e.value.version < s.db[k].version;
      return `<tr class="${live ? "" : "is-ghost"}${fresh ? " is-new" : ""}"><td>${k}</td><td>${escapeHtml(show(e.value))}${stale ? " ◐ stale" : ""}</td><td>${live ? `${left} s<span class="ttlbar" style="transform:scaleX(${left / total})"></span>` : "expired"}</td></tr>`;
    }).join("")}</tbody></table>`
    : `<p class="mono">${s.redisUp ? "(empty keyspace)" : "(unreachable)"}</p>`;

  els.rows.innerHTML = `<table class="keys mono"><thead><tr><th>id</th><th>name</th><th>plan</th></tr></thead><tbody>${Object.entries(s.db).map(([k, r]) => `<tr><td>${k.split(":")[1]}</td><td>${r.name}</td><td>${r.plan}</td></tr>`).join("")}</tbody></table>`;

  COUNTERS.forEach(([k]) => {
    const cell = $(`[data-c="${k}"]`, els.counters), b = cell.firstElementChild;
    if (b.textContent !== String(s.stats[k])) {
      b.textContent = s.stats[k];
      cell.classList.remove("is-bump"); void cell.offsetWidth; cell.classList.add("is-bump");
    }
  });
  els.log.innerHTML = s.log.length
    ? s.log.slice(-9).map((l) => `<li>${escapeHtml(l.cmd)}<span>${escapeHtml(l.reply)}</span></li>`).join("")
    : `<li>(no commands yet)</li>`;
  setText(els.now, `t = ${(s.now / 1000).toFixed(s.now % 1000 ? 3 : 0)} s`);
  renderStrips(els.strips, s, 6);

  // Controls show the present state, even while rewound
  const p = timeline ? timeline.present : s;
  segmented($("#inval"), p.invalidation);
  segmented($("#policy"), p.policy);
  els.ttl.value = p.ttl;
  setText(els.ttlOut, `${p.ttl} s`);
  setText(els.down, p.redisUp ? "Stop Redis" : "Start Redis");
};

let step = 0;
const onFrame = (frame, { instant }) => {
  schematic.show(frame, { instant });
  renderState(frame.state);
  const [title, text] = describe(frame);
  step = timeline ? timeline.cursor - timeline.traceStart + 1 : 0;
  els.caption.innerHTML = `<span class="caption__n">${String(Math.max(step, 0)).padStart(2, "0")}</span><strong class="caption__t">${escapeHtml(title)}</strong><span class="caption__d">${escapeHtml(text)}</span>`;
  const line = CODE_LINES[frame.type];
  codeLines.forEach((el, i) => el.classList.toggle("is-now", i + 1 === line));
  // The screen-reader summary only speaks at rest, not on every packet.
  if (frame.type === "request.done" || !timeline?.running) els.status.textContent = `${title}. ${text}`;
};

// ---------- Timeline ----------
const initial = (options = {}) => ({ type: "ready", state: sim.createState(options), packets: [], dur: 1 });
let timeline = null;
timeline = new Timeline({
  initial: initial(),
  onFrame,
  onProgress: (_, t) => schematic.progress(t),
  onChange: () => transport.update(),
});
const transport = createTransport($("#transport"), timeline, {
  label: (tl) => `step ${Math.max(0, tl.cursor - tl.traceStart + 1)}/${Math.max(0, tl.frames.length - tl.traceStart)}`,
});
pauseWhenHidden(bench, timeline);
transportKeys(bench, timeline);

// Slower pacing without travel, so each stop can be read.
const paced = (frames) => (reducedMotion() ? frames.map((f) => ({ ...f, dur: Math.max(f.dur, 1100) })) : frames);
const act = (fn, options) => {
  const frames = fn(timeline.present);
  if (frames?.length) timeline.push(paced(frames), options);
};
const settings = (patch) => act((s) => sim.configure(s, patch), { animate: false, restart: false });

const ACTIONS = {
  get: (key) => (s) => sim.get(s, key),
  clock: (seconds) => (s) => sim.advanceClock(s, seconds),
  update: (key) => (s) => sim.updateRecord(s, key, { plan: s.db[key].plan === "free" ? "pro" : "free" }),
  down: () => (s) => sim.setRedisUp(s, false),
};
const script = (steps) => steps.map(([name, ...args]) => ACTIONS[name](...args));

// ---------- Scenarios ----------
const tabs = $("#tabs");
tabs.innerHTML = Object.entries(SCENARIOS).map(([id, sc]) => `<button type="button" class="tab" data-value="${id}" aria-pressed="false"><span class="label">${sc.label}</span><b>${sc.title}</b></button>`).join("");

const runScenario = (id) => {
  const sc = SCENARIOS[id];
  segmented(tabs, id);
  els.lesson.textContent = sc.lesson;
  const { state } = sim.run(sim.createState(sc.options), ...script(sc.setup));
  timeline.reset({ type: "ready", state, packets: [], dur: 1 });
  const { frames } = sim.run(state, ...script(sc.play));
  timeline.push(paced(frames));
};
onSegment(tabs, runScenario);

// ---------- Experiment controls ----------
$("#get-42").addEventListener("click", () => act(ACTIONS.get("user:42")));
$("#get-7").addEventListener("click", () => act(ACTIONS.get("user:7")));
$("#clock-10").addEventListener("click", () => act(ACTIONS.clock(10)));
$("#clock-60").addEventListener("click", () => act(ACTIONS.clock(60)));
els.ttl.addEventListener("input", () => settings({ ttl: Number(els.ttl.value) }));
$("#update").addEventListener("click", () => act(ACTIONS.update("user:42")));
onSegment($("#inval"), (invalidation) => settings({ invalidation }));
onSegment($("#policy"), (policy) => settings({ policy }));
els.down.addEventListener("click", () => act((s) => sim.setRedisUp(s, !s.redisUp)));
$("#reset").addEventListener("click", () => {
  segmented(tabs, "");
  els.lesson.textContent = "Clean slate. Send a request, or pick a scenario above.";
  timeline.reset(initial());
});

// ---------- Stampede: a second, smaller bench on the same simulation ----------
const crowd = $("#crowd");
const crowdStage = createSchematic($("#crowd-stage"));
let guarded = false;
const crowdFrame = (frame, { instant }) => {
  crowdStage.show(frame, { instant });
  const [title, text] = describe(frame);
  $("#crowd-caption").innerHTML = `<strong class="caption__t">${escapeHtml(title)}</strong><span class="caption__d">${escapeHtml(text)}</span>`;
};
const crowdLine = new Timeline({
  initial: initial(),
  onFrame: crowdFrame,
  onProgress: (_, t) => crowdStage.progress(t),
});
pauseWhenHidden(crowd, crowdLine);
onSegment($("#crowd-mode"), (mode) => { guarded = mode === "lock"; segmented($("#crowd-mode"), mode); });
segmented($("#crowd-mode"), "open");
$("#crowd-run").addEventListener("click", () => {
  const state = sim.createState();
  crowdLine.reset({ type: "ready", state, packets: [], dur: 1 });
  crowdLine.push(paced(sim.stampede(state, "user:42", 8, guarded)));
});

// ---------- Challenge ----------
// The answer is computed by running the question through the simulation.
const expiryRun = () => sim.run(sim.createState({ ttl: 30 }), ACTIONS.get("user:42"), ACTIONS.clock(31), ACTIONS.get("user:42"));
createChallenge($("#challenge"), {
  question: "user:42 was cached with a 30 s TTL. 31 seconds later, the same key is requested. What happens?",
  options: [
    "A hit. The entry is still in memory until something removes it.",
    "A miss. Postgres is queried and the key is cached again with a new TTL.",
    "An error. Redis reports that the key has expired.",
  ],
  answer: 1,
  verdict: () => {
    const { state } = expiryRun();
    const last = state.history[state.history.length - 1];
    return `The simulation gives ${state.stats.misses} misses, ${state.stats.hits} hits and ${state.stats.dbQueries} database queries, and that request took ${last.elapsed} ms. An expired key may linger in memory briefly, but Redis never returns it: reading it looks exactly like reading a key that was never there.`;
  },
  watch: {
    label: "Watch it happen ↑",
    run: () => {
      runScenario("expiry");
      bench.scrollIntoView({ behavior: reducedMotion() ? "auto" : "smooth" });
    },
  },
});

// ---------- First paint: render the empty state, run A once it's on screen ----------
onFrame(timeline.frame, { instant: true });
crowdFrame(crowdLine.frame, { instant: true });
transport.update();
segmented(tabs, "miss");
els.lesson.textContent = SCENARIOS.miss.lesson;
new IntersectionObserver(([entry], io) => {
  if (!entry.isIntersecting) return;
  io.disconnect();
  runScenario("miss");
}, { threshold: 0.35 }).observe($("#stage"));
