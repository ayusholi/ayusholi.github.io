// HONEYBADGER's rules: movement, collisions, the bicycle, who's in reach, the
// barber's routine and the pigeons. Plain functions over plain state, so the
// renderer and React only read the result. The state is mutated in place,
// because it changes sixty times a second.
import { AREAS, BIKE_START, BUILDINGS, KINDS, MAP_H, MAP_W, PIGEON_HOMES, PROPS, SPAWN, T, tileSolid } from "./world-content";
import type { Action, Actor, AreaId, Dir, Input, Prop, Rect, Target, WorldState } from "./world-types";

export const WALK = 62;
export const RUN = 96;
export const RIDE = 150;
export const HOP = 0.28;
const REACH = 14;

export const createWorld = (): WorldState => ({
  t: 0,
  player: { x: SPAWN.x, y: SPAWN.y, dir: "right", moving: false, stride: 0, riding: false, hop: 0, act: 0 },
  bike: { x: BIKE_START.x, y: BIKE_START.y, dir: "left" },
  cam: { x: 0, y: 0 },
  used: {},
  pigeons: PIGEON_HOMES.map((h) => ({ hx: h.x, hy: h.y, x: h.x, y: h.y, z: 0, flight: 0, vx: 0, vy: 0 })),
});

// ---------- Geometry ----------

/** The feet: what collides. Wide enough to read as a body, small enough for doors. */
export const feet = (x: number, y: number): Rect => ({ x: x - 5, y: y - 4, w: 10, h: 5 });

const overlaps = (a: Rect, b: Rect) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

export const solidOf = (prop: Prop): Rect | null => {
  const s = KINDS[prop.kind].solid;
  return s ? { x: prop.x + s.x, y: prop.y + s.y, w: s.w, h: s.h } : null;
};

const SOLIDS: Rect[] = PROPS.flatMap((p) => solidOf(p) ?? []);

export function blockedStatic(box: Rect): boolean {
  if (box.x < 0 || box.y < 0 || box.x + box.w > MAP_W || box.y + box.h > MAP_H) return true;
  const tx0 = Math.floor(box.x / T), tx1 = Math.floor((box.x + box.w - 0.001) / T);
  const ty0 = Math.floor(box.y / T), ty1 = Math.floor((box.y + box.h - 0.001) / T);
  for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) if (tileSolid(tx, ty)) return true;
  return SOLIDS.some((s) => overlaps(box, s));
}

// Every building's footprint, doors included: the bicycle stays outside.
const INDOORS: Rect[] = BUILDINGS.map((b) => ({ x: b.x0 * T, y: b.y0 * T, w: (b.x1 - b.x0 + 1) * T, h: (b.y1 - b.y0 + 1) * T }));
export const BIKES_OUTSIDE = "Bikes stay outside. Press E to get off.";

function blocked(s: WorldState, x: number, y: number): boolean {
  const box = feet(x, y);
  if (s.player.riding && INDOORS.some((r) => overlaps(box, r))) {
    s.note = { text: BIKES_OUTSIDE, until: s.t + 1.8 };
    return true;
  }
  if (blockedStatic(box)) return true;
  // The barber blocks the way, unless he has already walked into you.
  const b = barberAt(s.still ? 2 : s.t), bb = feet(b.x, b.y);
  return overlaps(box, bb) && !overlaps(feet(s.player.x, s.player.y), bb);
}

const distToRect = (x: number, y: number, r: Rect) => {
  const dx = Math.max(r.x - x, 0, x - (r.x + r.w));
  const dy = Math.max(r.y - y, 0, y - (r.y + r.h));
  return Math.hypot(dx, dy);
};

/** What a prop's interaction reach is measured from. */
export const reachRect = (prop: Prop): Rect => {
  const k = KINDS[prop.kind];
  return solidOf(prop) ?? { x: prop.x, y: prop.y, w: k.w, h: k.h };
};

export const areaAt = (x: number, y: number): AreaId | null =>
  AREAS.find((a) => x >= a.rect.x && x < a.rect.x + a.rect.w && y >= a.rect.y && y < a.rect.y + a.rect.h)?.id ?? null;

// ---------- Moving ----------

/** Moves along one axis a pixel at a time, nudging round corners so doors are easy to find. */
function slide(s: WorldState, dx: number, dy: number) {
  const p = s.player;
  const n = Math.max(1, Math.ceil(Math.abs(dx) + Math.abs(dy)));
  const sx = dx / n, sy = dy / n;
  for (let i = 0; i < n; i++) {
    if (!blocked(s, p.x + sx, p.y + sy)) { p.x += sx; p.y += sy; continue; }
    // Corner assist: if a step sideways (up to 5px) clears the way, take one pixel of it.
    for (let k = 1; k <= 5; k++) {
      for (const sign of [1, -1]) {
        const ox = sy !== 0 ? sign * k : 0, oy = sx !== 0 ? sign * k : 0;
        if (!blocked(s, p.x + ox + sx, p.y + oy + sy) && !blocked(s, p.x + Math.sign(ox), p.y + Math.sign(oy))) {
          p.x += Math.sign(ox); p.y += Math.sign(oy);
          return;
        }
      }
    }
    return;
  }
}

const dirOf = (x: number, y: number, prev: Dir): Dir => {
  if (Math.abs(x) > Math.abs(y) + 0.01) return x < 0 ? "left" : "right";
  if (Math.abs(y) > 0.01) return y < 0 ? "up" : "down";
  return prev;
};

export function step(s: WorldState, input: Input, dt: number) {
  s.t += dt;
  const p = s.player;
  p.hop = Math.max(0, p.hop - dt);
  p.act = Math.max(0, p.act - dt);

  const len = Math.hypot(input.x, input.y);
  p.moving = len > 0.01 && p.hop === 0;
  if (p.moving) {
    // Diagonals are normalised, so every direction moves at the same speed.
    const ux = input.x / Math.max(1, len), uy = input.y / Math.max(1, len);
    const speed = p.riding ? RIDE : input.run ? RUN : WALK;
    const x0 = p.x, y0 = p.y;
    p.dir = dirOf(ux, uy, p.dir);
    slide(s, ux * speed * dt, 0);
    slide(s, 0, uy * speed * dt);
    const moved = Math.hypot(p.x - x0, p.y - y0);
    p.moving = moved > 0.001;
    p.stride += moved;
  }
  if (p.riding) { s.bike.x = p.x; s.bike.y = p.y; s.bike.dir = p.dir; }
  if (s.note && s.t > s.note.until) s.note = undefined;
  stepPigeons(s, dt);
}

/** Eases the camera toward the player, inside the map's edges. */
export function follow(s: WorldState, viewW: number, viewH: number, dt: number, snap = false) {
  const clamp = (v: number, size: number, view: number) => (size <= view ? (size - view) / 2 : Math.min(Math.max(v, 0), size - view));
  const tx = clamp(s.player.x - viewW / 2, MAP_W, viewW);
  const ty = clamp(s.player.y - 10 - viewH / 2, MAP_H, viewH);
  const k = snap ? 1 : 1 - Math.exp(-dt * 7);
  s.cam.x += (tx - s.cam.x) * k;
  s.cam.y += (ty - s.cam.y) * k;
}

// ---------- Interacting ----------

const INTERACTIVE = PROPS.filter((x) => x.panel);

/** The nearest thing in reach, preferring whatever the character faces. */
export function target(s: WorldState): Target | null {
  const p = s.player;
  if (p.riding) return { kind: "bike" };
  const fx = p.dir === "left" ? -1 : p.dir === "right" ? 1 : 0;
  const fy = p.dir === "up" ? -1 : p.dir === "down" ? 1 : 0;
  let best: Target | null = null, bestScore = Infinity;
  for (const prop of INTERACTIVE) {
    const rr = reachRect(prop);
    const d = distToRect(p.x, p.y - 2, rr);
    if (d > REACH) continue;
    const toward = (rr.x + rr.w / 2 - p.x) * fx + (rr.y + rr.h / 2 - p.y) * fy > 0;
    const score = d - (toward ? 6 : 0);
    if (score < bestScore) { bestScore = score; best = { kind: "prop", prop }; }
  }
  const bd = Math.hypot(s.bike.x - p.x, s.bike.y - p.y);
  if (bd < 18 && bd - 4 < bestScore) best = { kind: "bike" };
  return best;
}

export function interact(s: WorldState): Action {
  const p = s.player;
  const t = target(s);
  if (!t) return { type: "none" };
  if (t.kind === "bike") return p.riding ? dismount(s) : mount(s);
  s.used[t.prop.id] = s.t;
  p.act = 0.35;
  return { type: "panel", panel: t.prop.panel!, prop: t.prop };
}

function mount(s: WorldState): Action {
  const p = s.player;
  if (blocked(s, s.bike.x, s.bike.y)) return { type: "blocked", text: "Can't reach the saddle from here" };
  p.x = s.bike.x; p.y = s.bike.y; p.dir = s.bike.dir;
  p.riding = true; p.hop = HOP;
  return { type: "mount" };
}

function dismount(s: WorldState): Action {
  const p = s.player;
  const side = p.dir === "left" || p.dir === "right";
  const tries = side ? [[0, 9], [0, -9], [0, 14], [0, -14]] : [[11, 0], [-11, 0], [16, 0], [-16, 0]];
  for (const [ox, oy] of tries) {
    if (blocked(s, p.x + ox!, p.y + oy!)) continue;
    s.bike = { x: p.x, y: p.y, dir: p.dir };
    p.x += ox!; p.y += oy!;
    p.riding = false; p.hop = HOP;
    s.note = undefined;
    return { type: "dismount" };
  }
  s.note = { text: "No room to get off here", until: s.t + 1.6 };
  return { type: "blocked", text: "No room to get off here" };
}

/** Whether the player is still close enough to keep a prop's panel open. */
export const near = (s: WorldState, prop: Prop, slack = 34) => distToRect(s.player.x, s.player.y, reachRect(prop)) <= REACH + slack;

// ---------- The barber's routine ----------

export const CUT_LOOP = 9;
const STATIONS: { x: number; y: number; dir: Dir }[] = [
  { x: 37, y: 377, dir: "right" },
  { x: 53, y: 391, dir: "up" },
  { x: 70, y: 377, dir: "left" },
  { x: 53, y: 391, dir: "up" },
];
// Each stop: cut for a while, then walk to the next one.
const CUT = 1.6, WALK_TIME = 0.65;

/** Where the barber is at time t: circling the chair, cutting at each side. */
export function barberAt(t: number): Actor {
  const seg = CUT + WALK_TIME;
  const local = ((t % (seg * 4)) + seg * 4) % (seg * 4);
  const i = Math.floor(local / seg);
  const into = local - i * seg;
  const a = STATIONS[i]!, b = STATIONS[(i + 1) % 4]!;
  if (into < CUT) return { x: a.x, y: a.y, dir: a.dir, moving: false, stride: 0, cutting: true };
  const k = (into - CUT) / WALK_TIME;
  const x = a.x + (b.x - a.x) * k, y = a.y + (b.y - a.y) * k;
  return { x, y, dir: dirOf(b.x - a.x, b.y - a.y, a.dir), moving: true, stride: k * 24, cutting: false };
}

/** How much hair the current customer has left (2 → 0), and which customer it is. */
export const haircut = (t: number) => {
  const loop = CUT_LOOP;
  const n = Math.floor(t / loop);
  const k = (t - n * loop) / loop;
  return { customer: ((n % 3) + 3) % 3, length: k < 0.34 ? 2 : k < 0.7 ? 1 : 0 };
};

// ---------- Pigeons: they scatter when you get close ----------

function stepPigeons(s: WorldState, dt: number) {
  const p = s.player;
  s.pigeons.forEach((g, i) => {
    if (g.flight === 0) {
      const d = Math.hypot(g.x - p.x, g.y - p.y);
      if (d < (p.riding ? 40 : 28)) {
        const a = Math.atan2(g.y - p.y, g.x - p.x) + (i - 1) * 0.4;
        g.vx = Math.cos(a) * 70; g.vy = Math.sin(a) * 40 - 20; g.flight = dt;
      }
      return;
    }
    g.flight += dt;
    if (g.flight < 2.2) {
      g.x += g.vx * dt; g.y += g.vy * dt; g.z = Math.min(40, g.z + 50 * dt);
    } else if (g.flight > 6) {
      // Glide back home once the coast is clear.
      const d = Math.hypot(g.hx - p.x, g.hy - p.y);
      if (d < 50) return;
      g.x += (g.hx - g.x) * Math.min(1, dt * 1.5);
      g.y += (g.hy - g.y) * Math.min(1, dt * 1.5);
      g.z = Math.max(0, g.z - 30 * dt);
      if (g.z === 0 && Math.hypot(g.hx - g.x, g.hy - g.y) < 1) { g.x = g.hx; g.y = g.hy; g.flight = 0; }
    }
  });
}

/** Walk-cycle frame (0–3) from distance travelled. */
export const walkFrame = (stride: number, perFrame = 7) => Math.floor(stride / perFrame) % 4;
