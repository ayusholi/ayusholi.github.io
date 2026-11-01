// The publication's front page: the live system in the opening, the plates,
// the collections index, and search across all of it.
import { TOPICS, COLLECTIONS, CONCEPT_LINKS, collectionById } from "./topics.js";
import { PREVIEWS } from "./previews.js";
import { Timeline } from "./core/timeline.js";
import { $, $$, escapeHtml, pauseWhenHidden, reducedMotion } from "./core/dom.js";
import { createSchematic, renderStrips, STRIP_KEY } from "../redis/schematic.js";
import { describe, ROLES } from "../redis/content.js";
import * as sim from "../redis/sim.js";

// ---------- Opening: the real Redis simulation, with Nginx in front ----------
const KEY = "user:42";
const caption = $("#hero-caption"), strips = $("#hero-strips"), inspector = $("#hero-inspect");
const defaultInspect = inspector.innerHTML;
const schematic = createSchematic($("#hero-stage"), {
  edge: true,
  onInspect: (id) => {
    inspector.innerHTML = id
      ? `<p class="label">Inspecting</p><h3>${ROLES[id].name}</h3><p>${ROLES[id].role}</p>`
      : defaultInspect;
  },
});
$("#hero-key").innerHTML = STRIP_KEY;

const start = () => sim.createState({ edge: true, ttl: 30 });
const timeline = new Timeline({
  initial: { type: "ready", state: start(), packets: [], dur: 1 },
  onFrame: (frame, { instant }) => {
    schematic.show(frame, { instant });
    renderStrips(strips, frame.state, 4);
    const [title, text] = describe(frame);
    caption.innerHTML = `<strong class="caption__t">${escapeHtml(title)}</strong><span class="caption__d">${escapeHtml(text)}</span>`;
    $("#hero-clear").disabled = !Object.keys(timeline?.present.cache ?? {}).length;
  },
  onProgress: (_, t) => schematic.progress(t),
});
pauseWhenHidden($("#hero"), timeline);

const paced = (frames) => (reducedMotion() ? frames.map((f) => ({ ...f, dur: Math.max(f.dur, 1000) })) : frames);
const act = (fn) => timeline.push(paced(fn(timeline.present)));
const fast = (frames) => frames.map((f) => ({ ...f, dur: f.dur * 0.55 }));

$("#hero-send").addEventListener("click", () => act((s) => sim.get(s, KEY)));
$("#hero-clear").addEventListener("click", () => act((s) => sim.flush(s)));
$("#hero-wait").addEventListener("click", () => act((s) => sim.advanceClock(s, 31)));

// Show first: one miss then one hit, once, as soon as it's visible.
new IntersectionObserver(([entry], io) => {
  if (!entry.isIntersecting) return;
  io.disconnect();
  const { frames } = sim.run(timeline.present, (s) => sim.get(s, KEY), (s) => sim.get(s, KEY));
  timeline.push(fast(paced(frames)));
}, { threshold: 0.3 }).observe($("#hero"));

timeline.onFrame(timeline.frame, { instant: true });

// ---------- Plates ----------
const plates = $("#plate-grid");
plates.innerHTML = TOPICS.map((t, i) => {
  const live = t.status === "live";
  const tag = live ? "a" : "div";
  const coll = collectionById(t.collection).title;
  return `
    <${tag} class="plate plate--${t.size} stock-${t.stock}" data-find="${escapeHtml(`${t.title} ${t.question} ${coll}`.toLowerCase())}"${live ? ` href="${t.slug}/"` : ""}>
      <div class="plate__top label"><span>Nº ${String(i + 1).padStart(2, "0")}</span><span>${coll}</span></div>
      <div class="plate__art">${PREVIEWS[t.slug] || ""}</div>
      <div>
        <h3 class="plate__title">${t.title}</h3>
        <p class="plate__q">${t.question}</p>
        <div class="plate__meta label">
          <span class="${live ? "plate__live" : ""}">${live ? "Interactive" : "On the drawing board"}</span>
          <span>${live ? "" : "≈ "}${t.minutes} min</span>
        </div>
      </div>
    </${tag}>`;
}).join("");

// ---------- Collections ----------
const index = $("#index");
index.innerHTML = COLLECTIONS.map((c, i) => `
  <details class="coll" data-find="${escapeHtml(`${c.title} ${c.items.join(" ")}`.toLowerCase())}">
    <summary>
      <span class="label">${String(i + 1).padStart(2, "0")}</span>
      <span class="coll__t">${c.title}</span>
      <span class="coll__l">${c.line}</span>
      <span class="label">${c.items.length} concepts</span>
    </summary>
    <div class="coll__items">${c.items.map((item) => (CONCEPT_LINKS[item]
      ? `<a class="concept" href="${CONCEPT_LINKS[item]}/">${item}</a>`
      : `<span class="concept">${item}</span>`)).join("")}</div>
  </details>`).join("");

// ---------- Search: filters both lists, opening collections that match ----------
const input = $("#find"), none = $("#find-none");
input.addEventListener("input", () => {
  const q = input.value.trim().toLowerCase();
  let shown = 0;
  $$("[data-find]").forEach((el) => {
    const match = !q || el.dataset.find.includes(q);
    if (el.classList.contains("plate")) el.classList.toggle("is-hidden", !match);
    else { el.hidden = !match; el.open = !!q && match; }
    if (match) shown++;
  });
  none.hidden = shown > 0;
  none.textContent = shown ? "" : `Nothing on “${input.value}” yet.`;
});
