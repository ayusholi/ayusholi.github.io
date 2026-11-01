// The cache-aside diagram, plus the latency strips. It draws frames and owns
// no logic. Used by the Redis topic and the publication homepage.
import { createStage } from "../js/core/stage.js";
import { $, setText, reducedMotion } from "../js/core/dom.js";
import { ROLES } from "./content.js";
import { isLive } from "./sim.js";

const CELLS = 2;   // one slot per demo key

const LAYOUTS = {
  plain: (w) => (w < 620
    ? { height: 470, at: { client: [0.5, 62], app: [0.5, 214], redis: [0.26, 376], db: [0.74, 376] } }
    : { height: 400, at: { client: [0.13, 200], app: [0.47, 200], redis: [0.84, 86], db: [0.84, 314] } }),
  edge: (w) => (w < 620
    ? { height: 560, at: { client: [0.5, 56], edge: [0.5, 180], app: [0.5, 306], redis: [0.26, 466], db: [0.74, 466] } }
    : { height: 330, at: { client: [0.1, 165], edge: [0.335, 165], app: [0.575, 165], redis: [0.875, 68], db: [0.875, 262] } }),
};

export const createSchematic = (root, { edge = false, onInspect = () => {} } = {}) => {
  root.classList.add("stage");
  const ids = edge ? ["client", "edge", "app", "redis", "db"] : ["client", "app", "redis", "db"];
  const nodes = {};
  ids.forEach((id) => {
    const r = ROLES[id];
    const el = document.createElement("button");
    el.type = "button";
    el.className = "node";
    el.dataset.node = id;
    el.setAttribute("aria-label", `${r.name}: ${r.sub}. Inspect`);
    el.innerHTML = `<span class="node__tag" data-tag></span><span class="node__name">${r.name}</span><span class="node__sub" data-sub>${r.sub}</span>${id === "redis" ? `<span class="node__cells" aria-hidden="true">${"<i></i>".repeat(CELLS)}</span>` : ""}`;
    root.appendChild(el);
    nodes[id] = el;
  });

  const edges = edge
    ? [["client", "edge"], ["edge", "app"], ["app", "redis"], ["app", "db"]]
    : [["client", "app"], ["app", "redis"], ["app", "db"]];
  const stage = createStage(root, { nodes, edges, layout: LAYOUTS[edge ? "edge" : "plain"] });

  let selected = null;
  const select = (id) => {
    selected = selected === id ? null : id;
    Object.entries(nodes).forEach(([n, el]) => el.classList.toggle("is-selected", n === selected));
    stage.highlight(selected);
    onInspect(selected);
  };
  Object.entries(nodes).forEach(([id, el]) => {
    el.addEventListener("click", () => select(id));
    el.addEventListener("pointerenter", () => { if (!selected) stage.highlight(id); });
    el.addEventListener("pointerleave", () => { if (!selected) stage.highlight(null); });
    el.addEventListener("focus", () => { if (!selected) stage.highlight(id); });
    el.addEventListener("blur", () => { if (!selected) stage.highlight(null); });
  });

  const tag = (id, text) => setText($("[data-tag]", nodes[id]), text);

  return {
    show(frame, { instant } = {}) {
      const s = frame.state;
      stage.setPackets(instant ? [] : frame.packets || []);
      Object.entries(nodes).forEach(([id, el]) => el.classList.toggle("is-active", frame.at === id && !instant));
      nodes.redis.classList.toggle("is-down", !s.redisUp);
      setText($("[data-sub]", nodes.redis), s.redisUp ? ROLES.redis.sub : "✕ Unavailable");

      const keys = Object.values(s.cache);
      [...nodes.redis.querySelectorAll(".node__cells i")].forEach((cell, i) => {
        cell.className = keys[i] ? (isLive(keys[i], s.now) ? "is-on" : "is-ghost") : "";
      });
      tag("redis", s.redisUp ? `${keys.filter((k) => isLive(k, s.now)).length} live` : "down");
      tag("db", `${s.stats.dbQueries} ${s.stats.dbQueries === 1 ? "query" : "queries"}`);

      // A hit should visibly leave the database out of it.
      const done = frame.type === "request.done" ? s.history[s.history.length - 1] : null;
      const avoided = s.req?.reason === "hit" || done?.status === "hit" || done?.status === "stale";
      nodes.db.classList.toggle("is-rested", avoided);
      setText($("[data-sub]", nodes.db), avoided ? "Not queried" : ROLES.db.sub);
    },
    progress(t) { stage.progress(reducedMotion() ? 1 : t); },
  };
};

// ---------- Latency strips ----------
const STATUS = {
  hit: "● hit", miss: "○ miss", stale: "◐ stale", bypass: "△ bypass", failed: "✕ failed",
};
const SCALE = 200;   // milliseconds across the full width

const row = (r, live) => `
  <div class="fall__row${live ? " is-live" : ""}">
    <span>${live ? "▸ live" : STATUS[r.status]}</span>
    <span class="fall__bar">${r.segments.map((seg) => `<i class="seg-${seg.node}" style="width:${(seg.ms / SCALE) * 100}%"></i>`).join("")}</span>
    <span class="fall__ms">${r.elapsed} ms</span>
  </div>`;

export const renderStrips = (root, state, limit = 5) => {
  const past = state.history.slice(-limit).reverse();
  const live = state.req && state.req.segments.length ? [row(state.req, true)] : [];
  const html = live.concat(past.map((r) => row(r))).join("");
  root.innerHTML = html || `<p class="fall__empty">No requests yet. Each one is drawn here to scale.</p>`;
};

export const STRIP_KEY = `
  <span class="k-network">network</span><span class="k-redis">Redis</span><span class="k-postgres">Postgres</span><span class="k-timeout">timeout</span>`;
