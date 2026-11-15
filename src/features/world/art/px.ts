// The pixel toolkit every sprite is drawn with: one palette, a 3×5 font and a
// handful of primitives. Sprites are drawn once at 1× and scaled up without
// smoothing, so everything shares the same pixel grid.

export const C = {
  ink: "#15100e", ink2: "#251c19",
  grass0: "#243c28", grass1: "#2c4a30", grass2: "#375b37", grass3: "#4d7a42",
  path0: "#6a6056", path1: "#7c7164", path2: "#544c44", path3: "#928677",
  wood0: "#6b4631", wood1: "#77503a", wood2: "#55382a", wood3: "#87603f",
  carpet0: "#2b3142", carpet1: "#323a4e", carpet2: "#252a39",
  checkA: "#d6cebf", checkB: "#2a2523",
  uni0: "#5c5955", uni1: "#67635e", uni2: "#4d4a46",
  pave0: "#77716a", pave1: "#827b73", pave2: "#5f5953",
  road0: "#2b2a2f", road1: "#323137", roadLine: "#d8d1bc", kerb: "#9b938a",
  water0: "#1d3a58", water1: "#264d75", water2: "#5c90bd",
  hedge0: "#1a3020", hedge1: "#25442b", hedge2: "#335d38",
  cap: "#3a2c27", capHi: "#544038", capD: "#271e1b",
  plaster0: "#8c7967", plaster1: "#988472", plasterS: "#736356",
  brick0: "#8a3b2c", brick1: "#9a4635", mortar: "#5c2b21",
  panel0: "#3c4458", panel1: "#465069", panelS: "#30374a",
  tile0: "#d4ccbd", tile1: "#c4baa9", tileS: "#9f958a",
  base: "#2b211d",
  wood: "#8b5a3a", woodHi: "#a56e47", woodS: "#63412c", woodD: "#472e20",
  oak: "#a07a55", oakHi: "#b98f66", oakS: "#6e5240",
  metal: "#8e959c", metalHi: "#c7ccd0", metalS: "#5e646a", metalD: "#3b4045",
  screen: "#0e161d", glow: "#7fd6ff", glowS: "#2f7aa8",
  code1: "#ff7a4d", code2: "#c9e87a", code3: "#9fb6ff", code4: "#e9e2d4",
  red: "#fe3602", redS: "#b32804", redD: "#701b05",
  leather: "#8f241b", leatherS: "#6a1a13",
  white: "#efe9dc", whiteS: "#cdc5b6",
  leaf0: "#21422a", leaf1: "#2c5833", leaf2: "#3b7541", leaf3: "#58934e",
  bark: "#5b3d2a", barkS: "#3e2a1d",
  light: "#ffd88a", lightHi: "#fff1c6",
  bus: "#c8261d", busHi: "#dc3a2e", busS: "#8f1a14",
  green: "#5bd17a", amber: "#f2b33d", blue: "#2f56b8",
  teal: "#3fa38f", tealS: "#2a6e61",
  stone: "#b49a6a", stoneS: "#8d7550", stoneHi: "#cdb585",
} as const;

/** A small, stable hash: the same tile always gets the same pebbles. */
export const hash = (a: number, b = 0, c = 0) => {
  let h = (a * 374761393 + b * 668265263 + c * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0);
};

// 3×5 glyphs, rows top to bottom.
const GLYPHS: Record<string, string> = {
  A: "010101111101101", B: "110101110101110", C: "011100100100011", D: "110101101101110",
  E: "111100110100111", F: "111100110100100", G: "011100101101011", H: "101101111101101",
  I: "111010010010111", J: "001001001101010", K: "101101110101101", L: "100100100100111",
  M: "101111111101101", N: "110101101101101", O: "010101101101010", P: "110101110100100",
  Q: "010101101110011", R: "110101110101101", S: "011100010001110", T: "111010010010010",
  U: "101101101101111", V: "101101101101010", W: "101101111111101", X: "101101010101101",
  Y: "101101010010010", Z: "111001010100111",
  "0": "111101101101111", "1": "010110010010111", "2": "110001010100111", "3": "110001010001110",
  "4": "101101111001001", "5": "111100110001110", "6": "011100111101111", "7": "111001010010010",
  "8": "111101111101111", "9": "111101111001110",
  ".": "000000000000010", "-": "000000111000000", "·": "000000010000000", " ": "000000000000000",
  "&": "010101010101011", ">": "100010001010100", "<": "001010100010001",
};

export const textWidth = (s: string) => Math.max(0, s.length * 4 - 1);

export class Px {
  constructor(public c: CanvasRenderingContext2D, public ox = 0, public oy = 0) {}

  r(x: number, y: number, w: number, h: number, col: string) {
    if (w <= 0 || h <= 0) return;
    this.c.fillStyle = col;
    this.c.fillRect(this.ox + x, this.oy + y, w, h);
  }
  p(x: number, y: number, col: string) { this.r(x, y, 1, 1, col); }
  at(x: number, y: number) { return new Px(this.c, this.ox + x, this.oy + y); }

  line(x0: number, y0: number, x1: number, y1: number, col: string, thick = 1) {
    x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
    const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    for (;;) {
      this.r(x0, y0, thick, thick, col);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; x0 += sx; }
      if (e2 <= dx) { err += dx; y0 += sy; }
    }
  }

  disc(cx: number, cy: number, rad: number, col: string) {
    for (let y = -rad; y <= rad; y++) {
      const w = Math.round(Math.sqrt(rad * rad - y * y + rad * 0.6));
      this.r(cx - w, cy + y, w * 2 + 1, 1, col);
    }
  }

  ring(cx: number, cy: number, rad: number, col: string) {
    for (let a = 0; a < 32; a++) {
      const t = (a / 32) * Math.PI * 2;
      this.p(Math.round(cx + Math.cos(t) * rad), Math.round(cy + Math.sin(t) * rad), col);
    }
  }

  /** A piece of furniture in 3/4 view: lit top, darker front. */
  box(x: number, y: number, w: number, h: number, topH: number, top: string, face: string, hi?: string) {
    this.r(x, y, w, topH, top);
    if (hi) this.r(x, y, w, 1, hi);
    this.r(x, y + topH, w, h - topH, face);
    this.r(x, y + topH, w, 1, C.ink2);
  }

  text(s: string, x: number, y: number, col: string) {
    [...s.toUpperCase()].forEach((ch, i) => {
      const g = GLYPHS[ch] ?? GLYPHS[" "]!;
      for (let k = 0; k < 15; k++) if (g[k] === "1") this.p(x + i * 4 + (k % 3), y + Math.floor(k / 3), col);
    });
  }
}

export const makeCanvas = (w: number, h: number) => {
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  const ctx = c.getContext("2d")!;
  ctx.imageSmoothingEnabled = false;
  return { c, ctx };
};

/** Draws `paint` into a canvas with a 1px margin, then traces a dark outline round it. */
export function sprite(w: number, h: number, paint: (g: Px) => void, outline = true): HTMLCanvasElement {
  const { c, ctx } = makeCanvas(w + 2, h + 2);
  paint(new Px(ctx, 1, 1));
  if (outline) trace(c, ctx);
  return c;
}

export function trace(c: HTMLCanvasElement, ctx: CanvasRenderingContext2D, col: [number, number, number] = [21, 16, 14]) {
  const img = ctx.getImageData(0, 0, c.width, c.height);
  const d = img.data, W = c.width, H = c.height;
  const solid = (x: number, y: number) => x >= 0 && y >= 0 && x < W && y < H && d[(y * W + x) * 4 + 3]! > 140;
  const add: number[] = [];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (solid(x, y)) continue;
    if (solid(x - 1, y) || solid(x + 1, y) || solid(x, y - 1) || solid(x, y + 1)) add.push((y * W + x) * 4);
  }
  for (const i of add) { d[i] = col[0]; d[i + 1] = col[1]; d[i + 2] = col[2]; d[i + 3] = 255; }
  ctx.putImageData(img, 0, 0);
}

/** A white silhouette of a sprite, for the "you can use this" highlight. */
export function silhouette(src: HTMLCanvasElement): HTMLCanvasElement {
  const { c, ctx } = makeCanvas(src.width + 2, src.height + 2);
  for (const [dx, dy] of [[0, 1], [2, 1], [1, 0], [1, 2]]) ctx.drawImage(src, dx!, dy!);
  ctx.globalCompositeOperation = "source-in";
  ctx.fillStyle = "#fff4d8";
  ctx.fillRect(0, 0, c.width, c.height);
  return c;
}
