// Characters and the bicycle. One body plan (16×20, feet on the bottom row)
// shared by everyone, so the player, the barber and the customers all read as
// the same world. Right-facing frames are left-facing ones mirrored.
import type { Dir } from "../world-types";
import { C, Px, makeCanvas, trace } from "./px";

export type Look = {
  skin: string; skinS: string; hair: string;
  top: string; topS: string; acc: string;
  legs: string; legsS: string; shoe: string;
  apron?: string;
};

export const LOOKS = {
  // A small stand-in for Ayush: dark hair, red hoodie in the OS's accent.
  player: { skin: "#c08a5e", skinS: "#9b6943", hair: "#1b1412", top: "#e2390f", topS: "#a32807", acc: "#f3e9dc", legs: "#2b3245", legsS: "#1f2536", shoe: "#ebe4d6" },
  barber: { skin: "#b07a52", skinS: "#8c5d3b", hair: "#2a1d16", top: "#ebe5d8", topS: "#c3bbac", acc: "#ebe5d8", legs: "#25211f", legsS: "#1a1715", shoe: "#1a1514", apron: "#2a2421" },
  waiting: { skin: "#d9a77c", skinS: "#b5845c", hair: "#6b4a2a", top: "#3f6f8f", topS: "#2f5670", acc: "#3f6f8f", legs: "#2c2c34", legsS: "#212128", shoe: "#d8d0c0" },
} satisfies Record<string, Look>;

export const CUSTOMERS = [
  { skin: "#c08a5e", skinS: "#9b6943", hair: "#231915" },
  { skin: "#8d5e3c", skinS: "#6c462b", hair: "#121010" },
  { skin: "#e0b48d", skinS: "#bd8f69", hair: "#7a5230" },
];

type Pose = "walk" | "idle" | "act" | "cut" | "ride";
export type Face = "down" | "up" | "left";

/** One frame of a person. `frame` is the walk cycle (0–3). */
export function drawPerson(g: Px, L: Look, dir: Face, frame: number, pose: Pose) {
  const f = pose === "walk" ? frame : 0;
  const bob = (pose === "walk" && (f === 1 || f === 3)) || (pose === "idle" && frame === 1) ? 1 : 0;
  const legs = pose !== "ride";

  if (dir === "left") {
    if (legs) {
      if (f === 1) { g.r(9, 15, 2, 3, L.legsS); g.r(9, 18, 3, 1, L.shoe); g.r(5, 15, 2, 4, L.legs); g.r(4, 19, 3, 1, L.shoe); }
      else if (f === 3) { g.r(5, 15, 2, 3, L.legsS); g.r(4, 18, 3, 1, L.shoe); g.r(9, 15, 2, 4, L.legs); g.r(9, 19, 3, 1, L.shoe); }
      else { g.r(7, 15, 2, 4, L.legs); g.r(8, 15, 1, 4, L.legsS); g.r(6, 19, 3, 1, L.shoe); }
    }
    const b = g.at(0, bob);
    b.r(5, 9, 6, 6, L.top); b.r(10, 9, 1, 6, L.topS); b.r(5, 14, 6, 1, L.topS); b.r(9, 9, 2, 2, L.topS);
    if (L.apron) b.r(5, 11, 4, 4, L.apron);
    // the near arm
    if (pose === "act") { b.r(3, 11, 5, 2, L.top); b.r(2, 11, 1, 2, L.skin); }
    else if (pose === "cut") { b.r(3, 10, 5, 2, L.top); b.p(2, 10, L.skin); b.r(0, 9, 2, 1, C.metalHi); b.p(1, 10, C.metalS); }
    else if (pose === "walk" && f === 1) { b.r(8, 10, 2, 4, L.top); b.r(9, 14, 1, 1, L.skin); }
    else if (pose === "walk" && f === 3) { b.r(6, 10, 2, 3, L.top); b.p(5, 13, L.skin); }
    else if (pose !== "ride") { b.r(7, 10, 2, 4, L.top); b.p(8, 10, L.topS); b.r(7, 14, 2, 1, L.skin); }
    // head
    b.r(5, 2, 6, 7, L.skin); b.r(4, 3, 7, 5, L.skin); b.p(3, 6, L.skin); b.r(5, 8, 4, 1, L.skinS);
    b.r(5, 1, 6, 1, L.hair); b.r(4, 2, 8, 2, L.hair); b.r(9, 3, 3, 4, L.hair); b.r(4, 4, 2, 1, L.hair);
    b.p(9, 5, L.skinS); b.p(5, 6, C.ink);
    return;
  }

  if (legs) {
    const lift = (side: 0 | 1) => (f === 1 && side === 1) || (f === 3 && side === 0) ? 1 : 0;
    const l = lift(0), rr = lift(1);
    g.r(5, 15, 2, 4 - l, L.legs); g.r(4, 19 - l, 3, 1, L.shoe);
    g.r(9, 15, 2, 4 - rr, L.legs); g.r(9, 19 - rr, 3, 1, L.shoe);
    g.r(7, 15, 2, 1, L.legsS);
  }
  const b = g.at(0, bob);
  b.r(4, 9, 8, 6, L.top); b.r(11, 9, 1, 6, L.topS); b.r(4, 14, 8, 1, L.topS);
  if (dir === "down") {
    if (L.apron) b.r(5, 11, 6, 4, L.apron);
    else { b.p(6, 10, L.acc); b.p(9, 10, L.acc); b.p(6, 11, L.acc); b.p(9, 11, L.acc); b.r(5, 12, 6, 1, L.topS); }
  } else {
    b.r(5, 9, 6, 2, L.topS);
  }
  // arms
  if (pose === "act" && dir === "down") { b.r(3, 10, 1, 2, L.top); b.r(12, 10, 1, 2, L.top); b.p(4, 12, L.skin); b.p(11, 12, L.skin); }
  else if (pose === "cut") {
    b.r(3, 10, 1, 4, L.top); b.p(3, 14, L.skin);
    b.r(12, 8, 1, 3, L.top); b.p(12, 7, L.skin); b.r(12, 5, 1, 2, C.metalHi); b.p(13, 6, C.metalS);
  } else if (pose !== "ride") {
    const swing = pose === "walk" ? (f === 1 ? -1 : f === 3 ? 1 : 0) : 0;
    b.r(3, 10, 1, 4 + swing, L.top); b.p(3, 14 + swing, L.skin);
    b.r(12, 10, 1, 4 - swing, L.top); b.p(12, 14 - swing, L.skin);
  }
  // head
  b.r(5, 2, 6, 7, L.skin); b.r(4, 3, 8, 5, L.skin); b.r(5, 8, 6, 1, L.skinS);
  if (dir === "down") {
    b.r(5, 1, 6, 1, L.hair); b.r(4, 2, 8, 2, L.hair); b.r(4, 4, 4, 1, L.hair); b.p(11, 4, L.hair);
    b.p(4, 5, L.hair); b.p(11, 5, L.hair);
    b.p(6, 6, C.ink); b.p(9, 6, C.ink);
  } else {
    b.r(5, 1, 6, 1, L.hair); b.r(4, 2, 8, 5, L.hair); b.r(5, 7, 6, 1, L.hair);
    b.p(4, 5, L.skinS); b.p(11, 5, L.skinS);
  }
}

// ---------- Cached, outlined frames ----------

const cache = new Map<string, HTMLCanvasElement>();
const cached = (key: string, w: number, h: number, paint: (g: Px) => void) => {
  let c = cache.get(key);
  if (!c) {
    const m = makeCanvas(w + 2, h + 2);
    paint(new Px(m.ctx, 1, 1));
    trace(m.c, m.ctx);
    c = m.c;
    cache.set(key, c);
  }
  return c;
};

/** A person frame: 18×22 with outline; draw it with the feet at (x, y). */
export const person = (look: keyof typeof LOOKS, dir: Dir, frame: number, pose: Pose) => {
  const face: Face = dir === "right" ? "left" : dir;
  return cached(`p:${look}:${face}:${frame}:${pose}`, 16, 20, (g) => drawPerson(g, LOOKS[look], face, frame, pose));
};

// ---------- The bicycle ----------

function wheel(g: Px, cx: number, cy: number, spin: number) {
  g.ring(cx, cy, 4, "#1c1818");
  g.ring(cx, cy, 3.4, "#1c1818");
  const a = (spin * Math.PI) / 4;
  for (const o of [0, Math.PI / 2]) {
    g.line(cx + Math.cos(a + o) * 3, cy + Math.sin(a + o) * 3, cx - Math.cos(a + o) * 3, cy - Math.sin(a + o) * 3, C.metal);
  }
  g.p(cx, cy, C.metalHi);
}

/** Side view, facing left. 24×16, wheels on the bottom. */
export function drawBikeSide(g: Px, spin: number, frame: string = C.teal, frameS: string = C.tealS) {
  wheel(g, 5, 10, spin);
  wheel(g, 18, 10, spin);
  g.line(12, 11, 18, 10, frameS);
  g.line(11, 5, 18, 10, frameS);
  g.line(12, 11, 11, 4, frame);
  g.line(11, 5, 6, 5, frame);
  g.line(6, 5, 12, 11, frame);
  g.line(6, 4, 5, 10, frame);
  g.r(9, 3, 4, 1, C.ink2);
  g.r(4, 2, 3, 1, C.metalD); g.p(3, 2, C.ink2);
  const a = (spin * Math.PI) / 4;
  g.r(12 + Math.round(Math.cos(a) * 2), 11 + Math.round(Math.sin(a) * 2), 2, 1, C.metalS);
  g.p(12, 11, C.metalHi);
}

function drawBikeFront(g: Px, spin: number, back: boolean) {
  // narrow profile: one wheel toward the viewer, handlebars across
  g.r(6, 8, 2, 8, "#1c1818");
  for (let k = 0; k < 2; k++) g.p(6 + k, 9 + ((spin + k * 2) % 4) * 2, C.metalS);
  g.r(5, 6, 1, 5, C.teal); g.r(8, 6, 1, 5, C.teal);
  g.r(1, 5, 12, 1, C.metalD); g.r(0, 5, 2, 1, C.ink2); g.r(12, 5, 2, 1, C.ink2);
  if (back) { g.r(5, 3, 4, 2, C.ink2); g.p(6, 9, C.red); g.p(7, 9, C.red); }
  else { g.r(6, 6, 2, 1, C.light); }
}

/** A parked bicycle. Feet point (x, y) is the middle of its wheelbase. */
export const bike = (dir: Dir, spin = 0) => {
  if (dir === "up" || dir === "down") return cached(`b:${dir}:${spin % 4}`, 14, 16, (g) => drawBikeFront(g, spin % 4, dir === "up"));
  return cached(`b:side:${spin % 8}`, 24, 16, (g) => drawBikeSide(g, spin % 8));
};

/** Rider and bicycle together, as one outlined frame. */
export const rider = (dir: Dir, spin: number) => {
  const s = spin % 8;
  if (dir === "left" || dir === "right") {
    return cached(`r:side:${s}`, 24, 32, (g) => {
      const L = LOOKS.player;
      const a = (s * Math.PI) / 4;
      const pedal = (o: number) => ({ x: 12 + Math.round(Math.cos(a + o) * 3), y: 27 + Math.round(Math.sin(a + o) * 3) });
      const leg = (pd: { x: number; y: number }, col: string) => {
        const kx = Math.round(9 + (pd.x - 12) * 0.4), ky = Math.round(22 + (pd.y - 27) * 0.5);
        g.line(11, 19, kx, ky, col, 2); g.line(kx, ky, pd.x, pd.y - 1, col, 2); g.r(pd.x - 1, pd.y, 3, 1, L.shoe);
      };
      leg(pedal(Math.PI), L.legsS);
      drawBikeSide(g.at(0, 16), s);
      drawPerson(g.at(3, 4), L, "left", 0, "ride");
      g.line(9, 14, 6, 18, L.top, 2); g.p(5, 18, L.skin);
      leg(pedal(0), L.legs);
    });
  }
  const back = dir === "up";
  return cached(`r:${dir}:${s % 4}`, 16, 30, (g) => {
    const L = LOOKS.player;
    const o = s % 4 < 2 ? 1 : -1;
    if (back) drawBikeFront(g.at(1, 12), s % 4, true);
    g.r(3, 19 + o, 2, 4, L.legs); g.r(3, 23 + o, 2, 1, L.shoe);
    g.r(11, 19 - o, 2, 4, L.legs); g.r(11, 23 - o, 2, 1, L.shoe);
    drawPerson(g.at(0, 3), L, back ? "up" : "down", 0, "ride");
    g.line(4, 13, 2, 17, L.top); g.line(11, 13, 13, 17, L.top);
    if (!back) { drawBikeFront(g.at(1, 12), s % 4, false); g.p(1, 17, L.skin); g.p(14, 17, L.skin); }
    else { g.p(2, 17, L.skin); g.p(13, 17, L.skin); }
  });
};
