// =========================================================
// Stage: interactive nodes joined by two-lane wires, with data
// packets moving along them. Nodes are real <button>s laid over
// an SVG, so they keep native focus, keyboard and touch behaviour.
//
// Sized in real pixels rather than a scaled viewBox: labels stay
// the same size on a phone, and `layout(width)` rearranges instead.
// =========================================================
import { reducedMotion } from "./dom.js";

const SVG_NS = "http://www.w3.org/2000/svg";
const LANE = 5;      // distance of each lane from the wire's centre
const RADIUS = 9;    // corner radius on elbows
const STAGGER = 0.05;// fraction of a frame between packets in a group
const CHAR = 7;      // width of one label character

const svgEl = (name, attrs = {}) => {
  const el = document.createElementNS(SVG_NS, name);
  Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v));
  return el;
};

const rounded = (points) => {
  let d = `M${points[0][0]} ${points[0][1]}`;
  for (let i = 1; i < points.length - 1; i++) {
    const [px, py] = points[i - 1], [x, y] = points[i], [nx, ny] = points[i + 1];
    const r = Math.min(RADIUS, Math.hypot(x - px, y - py) / 2, Math.hypot(nx - x, ny - y) / 2);
    const inLen = Math.hypot(x - px, y - py) || 1, outLen = Math.hypot(nx - x, ny - y) || 1;
    d += ` L${x - ((x - px) / inLen) * r} ${y - ((y - py) / inLen) * r}`;
    d += ` Q${x} ${y} ${x + ((nx - x) / outLen) * r} ${y + ((ny - y) / outLen) * r}`;
  }
  const [lx, ly] = points[points.length - 1];
  return `${d} L${lx} ${ly}`;
};

// A path from box a to box b, shifted sideways by `off` to form a lane.
const route = (a, b, off) => {
  const dx = b.x - a.x, dy = b.y - a.y;
  const sx = Math.sign(dx) || 1, sy = Math.sign(dy) || 1;
  if (Math.abs(dx) > (a.w + b.w) / 2) {
    const x1 = a.x + sx * a.w / 2, x2 = b.x - sx * b.w / 2;
    if (Math.abs(dy) < 2) return rounded([[x1, a.y + off], [x2, a.y + off]]);
    const mid = (x1 + x2) / 2 + sx * off * sy;
    return rounded([[x1, a.y + off], [mid, a.y + off], [mid, b.y + off], [x2, b.y + off]]);
  }
  const y1 = a.y + sy * a.h / 2, y2 = b.y - sy * b.h / 2;
  if (Math.abs(dx) < 2) return rounded([[a.x + off, y1], [a.x + off, y2]]);
  const mid = (y1 + y2) / 2 + sy * off * sx;
  return rounded([[a.x + off, y1], [a.x + off, mid], [b.x + off, mid], [b.x + off, y2]]);
};

const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

export const createStage = (root, { nodes, edges, layout }) => {
  const svg = svgEl("svg", { class: "stage__wires", "aria-hidden": "true" });
  const defs = svgEl("defs");
  const uid = `arrow-${Math.random().toString(36).slice(2, 8)}`;
  const marker = svgEl("marker", { id: uid, viewBox: "0 0 8 8", refX: 7, refY: 4, markerWidth: 6, markerHeight: 6, orient: "auto" });
  marker.appendChild(svgEl("path", { d: "M1 1l6 3-6 3", fill: "none", stroke: "currentColor", "stroke-width": 1.2 }));
  defs.appendChild(marker);
  svg.appendChild(defs);
  root.prepend(svg);

  const wires = edges.flatMap(([a, b]) => [[a, b], [b, a]].map(([from, to]) => {
    const path = svgEl("path", { class: "wire", "marker-end": `url(#${uid})` });
    svg.appendChild(path);
    return { from, to, path, length: 0 };
  }));
  const wire = (from, to) => wires.find((w) => w.from === from && w.to === to);
  const packetLayer = svgEl("g");
  svg.appendChild(packetLayer);

  let boxes = {}, width = 0;

  const measure = () => {
    width = root.clientWidth;
    if (!width) return;
    const plan = layout(width);
    root.style.height = `${plan.height}px`;
    svg.setAttribute("width", width);
    svg.setAttribute("height", plan.height);
    Object.entries(nodes).forEach(([id, el]) => {
      const [fx, y] = plan.at[id];
      el.style.left = `${fx * width}px`;
      el.style.top = `${y}px`;
      boxes[id] = { x: fx * width, y, w: el.offsetWidth, h: el.offsetHeight };
    });
    wires.forEach((w) => {
      w.path.setAttribute("d", route(boxes[w.from], boxes[w.to], LANE));
      w.length = w.path.getTotalLength();
    });
    drawPackets(lastT);
  };

  // ---------- Packets ----------
  let active = [], lastT = 0;

  const makePacket = (p) => {
    const g = svgEl("g", { class: `pk pk--${p.kind}` });
    const label = p.label || "";
    const w = label.length * CHAR + 12;
    const rect = svgEl("rect", { x: -w / 2, y: -10, width: w, height: 20 });
    const text = svgEl("text", { y: 4, "text-anchor": "middle" });
    text.textContent = label;
    g.append(rect, text);
    packetLayer.appendChild(g);
    return { ...p, g, w, wire: wire(p.from, p.to) };
  };

  const clearPackets = () => { active.forEach((p) => p.g.remove()); active = []; };

  const setPackets = (list) => {
    clearPackets();
    active = list.map(makePacket).filter((p) => p.wire);
    wires.forEach((w) => w.path.classList.toggle("is-flow", active.some((p) => p.wire === w)));
    // A burst is a crowd: give each its own offset, and only one a label.
    if (active.length > 1) active.forEach((p, i) => {
      p.index = i;
      if (i) p.g.classList.add("pk--dot");
    });
  };

  const place = (p, t) => {
    const w = p.wire;
    const at = w.path.getPointAtLength(w.length * t);
    // keep labels inside the sheet on narrow screens
    const x = Math.max(p.w / 2 + 2, Math.min(width - p.w / 2 - 2, at.x));
    const y = at.y + (active.length > 1 ? ((p.index % 3) - 1) * 4 : 0);
    p.g.setAttribute("transform", `translate(${x.toFixed(1)} ${y.toFixed(1)})`);
  };

  const drawPackets = (t) => {
    lastT = t;
    const spread = STAGGER * Math.max(0, active.length - 1);
    active.forEach((p, i) => {
      // Reduced motion: no travel, the packet just sits where it arrived.
      if (reducedMotion()) { p.g.style.display = ""; place(p, 1); return; }
      const local = Math.min(1, Math.max(0, (t - i * STAGGER) / (1 - spread)));
      p.g.style.display = t >= 1 ? "none" : "";
      place(p, ease(local));
    });
  };

  // ---------- Highlights ----------
  const highlight = (id) => wires.forEach((w) => w.path.classList.toggle("is-lit", !!id && (w.from === id || w.to === id)));

  new ResizeObserver(measure).observe(root);
  if (document.fonts?.ready) document.fonts.ready.then(measure);
  measure();

  return { setPackets, progress: drawPackets, highlight, clearPackets };
};
