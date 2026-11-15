// The ground layer, painted once: grass, paths, floors, the street, water and
// the walls of every building. Characters and props are drawn over it.
import { BUILDINGS, COLS, MAP_H, MAP_W, ROWS, T, groundAt, wallAt } from "../world-content";
import type { Building, Ground } from "../world-types";
import { C, Px, hash, makeCanvas, textWidth } from "./px";

function grass(g: Px, tx: number, ty: number) {
  g.r(0, 0, T, T, C.grass1);
  for (let k = 0; k < 7; k++) {
    const h = hash(tx, ty, k);
    g.p(h % 16, (h >> 4) % 16, k < 3 ? C.grass0 : C.grass2);
  }
  const h = hash(tx, ty, 99);
  if (h % 3 === 0) { const x = (h >> 3) % 13, y = (h >> 8) % 12; g.p(x, y + 1, C.grass3); g.p(x + 2, y, C.grass3); g.p(x + 1, y + 2, C.grass2); }
  if (h % 23 === 0) { const x = (h >> 5) % 14, y = (h >> 10) % 14; g.p(x, y, h % 2 ? "#e6c45c" : "#d9dfe8"); }
}

function cobbles(g: Px, tx: number, ty: number) {
  g.r(0, 0, T, T, C.path2);
  const shift = ty % 2 ? 4 : 0;
  for (let row = 0; row < 2; row++) for (let col = -1; col < 2; col++) {
    const x = col * 8 + shift + (row ? 4 : 0), y = row * 8;
    const h = hash(tx * 3 + col, ty * 3 + row);
    g.r(x + 1, y + 1, 6, 6, h % 3 ? C.path0 : C.path1);
    g.r(x + 1, y + 1, 5, 1, C.path3);
    g.r(x + 1, y + 6, 6, 1, "#5d544b");
  }
}

function wood(g: Px, tx: number, ty: number) {
  for (let row = 0; row < 4; row++) {
    g.r(0, row * 4, T, 4, (row + ty) % 2 ? C.wood0 : C.wood1);
    g.r(0, row * 4 + 3, T, 1, C.wood2);
    const seam = hash(tx, ty, row) % 16;
    g.r(seam, row * 4, 1, 3, C.wood2);
    g.p((seam + 7) % 16, row * 4 + 1, C.wood3);
  }
}

function carpet(g: Px, tx: number, ty: number) {
  g.r(0, 0, T, T, C.carpet0);
  for (let y = 0; y < T; y += 4) for (let x = (y / 4) % 2 ? 2 : 0; x < T; x += 4) g.p(x, y, C.carpet1);
  if (hash(tx, ty) % 5 === 0) g.p(hash(tx, ty, 1) % 16, hash(tx, ty, 2) % 16, C.carpet2);
}

function checker(g: Px, tx: number, ty: number) {
  for (let y = 0; y < 2; y++) for (let x = 0; x < 2; x++) {
    const light = (tx * 2 + x + ty * 2 + y) % 2 === 0;
    g.r(x * 8, y * 8, 8, 8, light ? C.checkA : C.checkB);
    if (light) g.r(x * 8, y * 8 + 7, 8, 1, "#bfb6a6");
  }
}

function uni(g: Px) {
  g.r(0, 0, T, T, C.uni0);
  g.r(0, 0, T, 1, C.uni2); g.r(0, 0, 1, T, C.uni2);
  g.r(1, 1, 14, 1, C.uni1);
}

function pave(g: Px, tx: number, ty: number) {
  for (let y = 0; y < 2; y++) {
    const off = (ty * 2 + y) % 2 ? 8 : 0;
    for (let x = -1; x < 2; x++) {
      const h = hash(tx * 2 + x, ty * 2 + y);
      g.r(x * 16 + off, y * 8, 16, 8, h % 3 ? C.pave0 : C.pave1);
      g.r(x * 16 + off, y * 8, 1, 8, C.pave2);
    }
    g.r(0, y * 8 + 7, T, 1, C.pave2);
  }
}

function road(g: Px, tx: number, ty: number) {
  g.r(0, 0, T, T, C.road0);
  for (let k = 0; k < 5; k++) { const h = hash(tx, ty, k + 20); g.p(h % 16, (h >> 4) % 16, C.road1); }
  if (ty === 27 && tx % 2 === 0) g.r(3, 7, 10, 2, C.roadLine);
}

function water(g: Px, tx: number, ty: number) {
  g.r(0, 0, T, T, C.water0);
  for (let k = 0; k < 3; k++) {
    const h = hash(tx, ty, k + 40);
    g.r(h % 12, (h >> 4) % 15, 4, 1, C.water1);
  }
}

function hedge(g: Px, tx: number, ty: number) {
  g.r(0, 0, T, T, C.hedge1);
  for (let k = 0; k < 4; k++) {
    const h = hash(tx, ty, k + 60);
    g.disc(h % 16, (h >> 4) % 12 + 2, 3, k % 2 ? C.hedge2 : C.hedge1);
  }
  g.r(0, 13, T, 3, C.hedge0);
}

const PAINT: Record<Ground, (g: Px, tx: number, ty: number) => void> = {
  grass, path: cobbles, wood, carpet, checker, uni: (g) => uni(g), pave, road, water, hedge,
};

// ---------- Walls ----------

function face(g: Px, b: Building, tx: number, y: number, h: number) {
  // y: where the face starts inside this tile; h: how much of it this tile holds
  const top = y;
  if (b.wall === "brick") {
    g.r(0, top, T, h, C.brick0);
    for (let yy = 0; yy < h; yy += 4) {
      const row = Math.floor((yy + (b.y0 * T)) / 4);
      g.r(0, top + yy + 3, T, 1, C.mortar);
      for (let xx = (row % 2) * 4; xx < T; xx += 8) g.r(xx, top + yy, 1, 3, C.mortar);
      if (hash(tx, row) % 4 === 0) g.r((hash(tx, row, 1) % 12), top + yy, 4, 3, C.brick1);
    }
  } else if (b.wall === "panel") {
    g.r(0, top, T, h, C.panel0);
    for (let xx = 0; xx < T; xx += 8) { g.r(xx, top, 1, h, C.panelS); g.r(xx + 1, top, 1, h, C.panel1); }
  } else if (b.wall === "tile") {
    g.r(0, top, T, h, C.tile0);
    for (let yy = 0; yy < h; yy += 4) g.r(0, top + yy + 3, T, 1, C.tileS);
    for (let xx = 0; xx < T; xx += 6) g.r(xx, top, 1, h, C.tile1);
  } else {
    g.r(0, top, T, h, C.plaster0);
    for (let k = 0; k < 4; k++) { const hh = hash(tx, k, 7); g.p(hh % 16, top + (hh >> 4) % Math.max(1, h), C.plaster1); }
  }
}

function paintWall(g: Px, tx: number, ty: number, w: NonNullable<ReturnType<typeof wallAt>>) {
  const { b, part } = w;
  const isSide = tx === b.x0 || tx === b.x1;
  if (part === "north" && !isSide) {
    if (ty === b.y0) {
      g.r(0, 0, T, 6, C.cap); g.r(0, 0, T, 1, C.capHi); g.r(0, 5, T, 1, C.capD);
      face(g, b, tx, 6, 10);
      g.r(0, 6, T, 2, "rgba(0,0,0,0.28)");
    } else {
      face(g, b, tx, 0, T);
      // dado rail and skirting
      if (b.wall === "tile") g.r(0, 6, T, 10, C.checkB);
      if (b.wall === "plaster") g.r(0, 6, T, 1, C.woodS);
      g.r(0, 13, T, 3, C.base);
      g.r(0, 13, T, 1, "#3d302a");
    }
    return;
  }
  if (part === "south" && !isSide) {
    g.r(0, 0, T, 10, C.cap); g.r(0, 0, T, 1, C.capHi); g.r(0, 9, T, 1, C.capD);
    face(g, b, tx, 10, 6);
    g.r(0, 10, T, 1, "rgba(0,0,0,0.35)");
    return;
  }
  g.r(0, 0, T, T, C.cap);
  if (tx === b.x0) { g.r(T - 1, 0, 1, T, C.capHi); g.r(0, 0, 1, T, C.capD); }
  else { g.r(0, 0, 1, T, C.capHi); g.r(T - 1, 0, 1, T, C.capD); }
  if (ty === b.y1) { g.r(0, 10, T, 6, C.capD); }
}

function wallShadows(g: Px, tx: number, ty: number) {
  // soft shadow where floors meet walls
  const w = (x: number, y: number) => !!wallAt(x, y);
  if (w(tx, ty - 1)) g.r(0, 0, T, 3, "rgba(0,0,0,0.22)");
  if (w(tx - 1, ty)) g.r(0, 0, 2, T, "rgba(0,0,0,0.18)");
  if (w(tx + 1, ty)) g.r(T - 2, 0, 2, T, "rgba(0,0,0,0.12)");
}

const SIGNS: { text: string; tx: number; ty: number; dx: number; col: string }[] = [
  { text: "REPAIRS", tx: 3, ty: 10, dx: 2, col: C.light },
  { text: "WORKSPACE", tx: 35, ty: 10, dx: 4, col: C.glow },
  { text: "UNIVERSITY", tx: 37, ty: 23, dx: 4, col: C.white },
];

export function paintGround(): HTMLCanvasElement {
  const { c, ctx } = makeCanvas(MAP_W, MAP_H);
  for (let ty = 0; ty < ROWS; ty++) for (let tx = 0; tx < COLS; tx++) {
    const g = new Px(ctx, tx * T, ty * T);
    const ground = groundAt(tx, ty);
    PAINT[ground](g, tx, ty);

    // Blend edges between ground types so nothing reads as a grid.
    const n = ty > 0 ? groundAt(tx, ty - 1) : ground, s = ty < ROWS - 1 ? groundAt(tx, ty + 1) : ground;
    const wv = tx > 0 ? groundAt(tx - 1, ty) : ground, e = tx < COLS - 1 ? groundAt(tx + 1, ty) : ground;
    if (ground === "path") {
      for (let k = 0; k < T; k++) {
        if (n === "grass" && hash(tx, ty, k) % 3) g.p(k, 0, C.grass1);
        if (s === "grass" && hash(tx, ty, k + 16) % 3) g.p(k, T - 1, C.grass1);
        if (wv === "grass" && hash(tx, ty, k + 32) % 3) g.p(0, k, C.grass1);
        if (e === "grass" && hash(tx, ty, k + 48) % 3) g.p(T - 1, k, C.grass1);
      }
    }
    if (ground === "pave" && s === "road") { g.r(0, T - 2, T, 2, C.kerb); g.r(0, T - 1, T, 1, "#6f685f"); }
    if (ground === "pave" && n === "road") g.r(0, 0, T, 2, C.kerb);
    if (ground === "water" && n !== "water") {
      g.r(0, 0, T, 4, C.path1); g.r(0, 0, T, 1, C.path3); g.r(0, 4, T, 2, "rgba(0,0,0,0.35)");
      if (ty >= 30) { g.r(0, 0, T, 1, C.ink2); }
    }
    if (ground === "water" && ty < 30) {
      if (wv !== "water") g.r(0, 0, 3, T, C.path1);
      if (e !== "water") g.r(T - 3, 0, 3, T, C.path1);
      if (s !== "water") g.r(0, T - 3, T, 3, C.path1);
    }
    if (ground === "hedge") {
      if (s !== "hedge") g.r(0, T - 1, T, 1, C.ink);
    }
  }

  for (let ty = 0; ty < ROWS; ty++) for (let tx = 0; tx < COLS; tx++) {
    const g = new Px(ctx, tx * T, ty * T);
    const w = wallAt(tx, ty);
    if (w) paintWall(g, tx, ty, w);
    else if (BUILDINGS.some((b) => tx > b.x0 && tx < b.x1 && ty > b.y0 + 1 && ty < b.y1)) wallShadows(g, tx, ty);
  }

  // Door mats where the paths come in.
  for (const b of BUILDINGS) for (const d of b.doors) {
    if (d.side === "e") continue;
    const y = d.side === "s" ? b.y1 * T + 2 : (b.y0 + 2) * T + 1;
    const g = new Px(ctx, d.a * T + 3, y);
    g.r(0, 0, (d.b - d.a + 1) * T - 6, 6, "#5a2d22");
    g.r(1, 1, (d.b - d.a + 1) * T - 8, 4, "#7a3c2c");
  }

  for (const s of SIGNS) {
    const g = new Px(ctx, s.tx * T + s.dx, s.ty * T + 10);
    g.r(-2, 0, textWidth(s.text) + 4, 6, C.ink2);
    g.text(s.text, 0, 0, s.col);
  }
  return c;
}

/** Bright specks drifting on the river and pond. */
export function paintWaterShimmer(g: Px, t: number, x0: number, y0: number, x1: number, y1: number) {
  for (let ty = Math.max(0, Math.floor(y0 / T)); ty <= Math.min(ROWS - 1, Math.floor(y1 / T)); ty++) {
    for (let tx = Math.max(0, Math.floor(x0 / T)); tx <= Math.min(COLS - 1, Math.floor(x1 / T)); tx++) {
      if (groundAt(tx, ty) !== "water") continue;
      const h = hash(tx, ty, 5);
      const k = (t * 0.6 + (h % 100) / 100) % 1;
      if (k > 0.55) continue;
      const x = tx * T + (h % 10) + Math.round(k * 5), y = ty * T + 6 + ((h >> 4) % 8);
      g.r(x, y, 3, 1, k < 0.3 ? C.water2 : C.water1);
    }
  }
}
