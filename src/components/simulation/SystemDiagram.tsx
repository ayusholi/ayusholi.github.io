"use client";

import { useImperativeHandle, useLayoutEffect, useRef, useState, useId, type Ref } from "react";
import type { Packet } from "@/lib/simulation/simulation-types";
import { reducedMotion } from "@/lib/simulation/useTimeline";

// Interactive nodes joined by two-lane wires, with data packets moving along
// them. Nodes are real <button>s laid over an SVG, so they keep native focus,
// keyboard and touch behaviour.
//
// Sized in real pixels rather than a scaled viewBox: labels stay the same size
// on a phone, and `layout(width)` rearranges instead.
//
// Nodes and wires render through React. Packets don't: they move on every
// animation frame, so they're drawn directly and only `progress()` touches them.

const SVG_NS = "http://www.w3.org/2000/svg";
const LANE = 5;       // distance of each lane from the wire's centre
const RADIUS = 9;     // corner radius on elbows
const STAGGER = 0.05; // fraction of a frame between packets in a group
const CHAR = 7;       // width of one label character

type Point = [number, number];
type Box = { x: number; y: number; w: number; h: number };

export type DiagramNode = {
  id: string;
  name: string;
  sub: string;
  ariaLabel: string;
  tag?: string;
  cells?: ("on" | "ghost" | "off")[];
  active?: boolean;
  selected?: boolean;
  down?: boolean;
  rested?: boolean;
};
export type DiagramLayout = (width: number) => { height: number; at: Record<string, Point> };
export type DiagramHandle = { setPackets: (list: Packet[]) => void; progress: (t: number) => void };

const rounded = (points: Point[]) => {
  const [first] = points as [Point];
  let d = `M${first[0]} ${first[1]}`;
  for (let i = 1; i < points.length - 1; i++) {
    const [px, py] = points[i - 1] as Point, [x, y] = points[i] as Point, [nx, ny] = points[i + 1] as Point;
    const inLen = Math.hypot(x - px, y - py) || 1, outLen = Math.hypot(nx - x, ny - y) || 1;
    const r = Math.min(RADIUS, inLen / 2, outLen / 2);
    d += ` L${x - ((x - px) / inLen) * r} ${y - ((y - py) / inLen) * r}`;
    d += ` Q${x} ${y} ${x + ((nx - x) / outLen) * r} ${y + ((ny - y) / outLen) * r}`;
  }
  const [lx, ly] = points[points.length - 1] as Point;
  return `${d} L${lx} ${ly}`;
};

// A path from box a to box b, shifted sideways by `off` to form a lane.
const route = (a: Box, b: Box, off: number) => {
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

const ease = (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

type LivePacket = Packet & { g: SVGGElement; w: number; path: SVGPathElement; index: number };

type Props = {
  ref?: Ref<DiagramHandle>;
  nodes: DiagramNode[];
  edges: [string, string][];
  layout: DiagramLayout;
  onSelect: (id: string) => void;
  heights: { wide: number; narrow: number };
};

export const SystemDiagram = ({ ref, nodes, edges, layout, onSelect, heights }: Props) => {
  const rootRef = useRef<HTMLDivElement>(null);
  const layerRef = useRef<SVGGElement>(null);
  const paths = useRef(new Map<string, SVGPathElement>());
  const live = useRef<LivePacket[]>([]);
  const lastT = useRef(0);
  const arrow = useId();
  const [hovered, setHovered] = useState<string | null>(null);
  const [flowing, setFlowing] = useState<string[]>([]);
  const [geometry, setGeometry] = useState<{ width: number; height: number; at: Record<string, Point>; d: Record<string, string> } | null>(null);

  const selected = nodes.find((n) => n.selected)?.id ?? null;
  const focus = selected ?? hovered;
  const wires = edges.flatMap(([a, b]) => [[a, b], [b, a]] as const);

  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const measure = () => {
      const width = root.clientWidth;
      if (!width) return;
      const plan = layout(width);
      const boxes: Record<string, Box> = {};
      root.querySelectorAll<HTMLElement>("[data-node]").forEach((el) => {
        const id = el.dataset.node as string;
        const [fx, y] = plan.at[id] as Point;
        boxes[id] = { x: fx * width, y, w: el.offsetWidth, h: el.offsetHeight };
      });
      const d: Record<string, string> = {};
      wires.forEach(([from, to]) => { d[`${from}>${to}`] = route(boxes[from] as Box, boxes[to] as Box, LANE); });
      setGeometry({ width, height: plan.height, at: plan.at, d });
    };
    const observer = new ResizeObserver(measure);
    observer.observe(root);
    document.fonts?.ready.then(measure);
    measure();
    return () => observer.disconnect();
    // wires derive from edges, which never change for a mounted diagram
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layout]);

  const draw = (t: number) => {
    lastT.current = t;
    const list = live.current;
    const width = geometry?.width ?? rootRef.current?.clientWidth ?? 0;
    const spread = STAGGER * Math.max(0, list.length - 1);
    list.forEach((p, i) => {
      const still = reducedMotion();   // no travel: the packet just sits where it arrived
      const local = still ? 1 : ease(Math.min(1, Math.max(0, (t - i * STAGGER) / (1 - spread))));
      p.g.style.display = !still && t >= 1 ? "none" : "";
      const at = p.path.getPointAtLength(p.path.getTotalLength() * local);
      // keep labels inside the sheet on narrow screens
      const x = Math.max(p.w / 2 + 2, Math.min(width - p.w / 2 - 2, at.x));
      const y = at.y + (list.length > 1 ? ((p.index % 3) - 1) * 4 : 0);
      p.g.setAttribute("transform", `translate(${x.toFixed(1)} ${y.toFixed(1)})`);
    });
  };

  useImperativeHandle(ref, () => ({
    setPackets(list) {
      live.current.forEach((p) => p.g.remove());
      const made: LivePacket[] = [];
      list.forEach((packet, index) => {
        const path = paths.current.get(`${packet.from}>${packet.to}`);
        if (!path || !layerRef.current) return;
        const g = document.createElementNS(SVG_NS, "g");
        g.setAttribute("class", `pk pk--${packet.kind}${list.length > 1 && index ? " pk--dot" : ""}`);
        const w = packet.label.length * CHAR + 12;
        const rect = document.createElementNS(SVG_NS, "rect");
        Object.entries({ x: -w / 2, y: -10, width: w, height: 20 }).forEach(([k, v]) => rect.setAttribute(k, String(v)));
        const text = document.createElementNS(SVG_NS, "text");
        text.setAttribute("y", "4");
        text.setAttribute("text-anchor", "middle");
        text.textContent = packet.label;
        g.append(rect, text);
        layerRef.current.appendChild(g);
        made.push({ ...packet, g, w, path, index });
      });
      live.current = made;
      setFlowing(made.map((p) => `${p.from}>${p.to}`));
      draw(0);
    },
    progress: draw,
  }));

  return (
    <div className="stage-box">
      <div
        className="stage"
        ref={rootRef}
        data-ready={geometry ? "" : undefined}
        style={{ "--stage-wide": `${heights.wide}px`, "--stage-narrow": `${heights.narrow}px`, height: geometry?.height } as React.CSSProperties}
      >
        <svg className="stage__wires" aria-hidden="true" width={geometry?.width} height={geometry?.height}>
          <defs>
            <marker id={arrow} viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto">
              <path d="M1 1l6 3-6 3" fill="none" stroke="currentColor" strokeWidth="1.2" />
            </marker>
          </defs>
          {wires.map(([from, to]) => {
            const key = `${from}>${to}`;
            return (
              <path
                key={key}
                ref={(el) => { if (el) paths.current.set(key, el); else paths.current.delete(key); }}
                className={`wire${focus === from || focus === to ? " is-lit" : ""}${flowing.includes(key) ? " is-flow" : ""}`}
                d={geometry?.d[key]}
                markerEnd={`url(#${arrow})`}
              />
            );
          })}
          <g ref={layerRef} />
        </svg>
        {nodes.map((n) => {
          const [fx, y] = geometry?.at[n.id] ?? layout(1000).at[n.id] as Point;
          return (
            <button
              key={n.id}
              type="button"
              data-node={n.id}
              className={`node${n.active ? " is-active" : ""}${n.selected ? " is-selected" : ""}${n.down ? " is-down" : ""}${n.rested ? " is-rested" : ""}`}
              style={{ left: `${fx * 100}%`, top: y }}
              aria-label={n.ariaLabel}
              aria-pressed={!!n.selected}
              onClick={() => onSelect(n.id)}
              onPointerEnter={() => setHovered(n.id)}
              onPointerLeave={() => setHovered(null)}
              onFocus={() => setHovered(n.id)}
              onBlur={() => setHovered(null)}
            >
              {n.tag && <span className="node__tag">{n.tag}</span>}
              <span className="node__name">{n.name}</span>
              <span className="node__sub">{n.sub}</span>
              {n.cells && (
                <span className="node__cells" aria-hidden="true">
                  {n.cells.map((c, i) => <i key={i} className={c === "off" ? "" : `is-${c}`} />)}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};
