// Every object in the world. BASE paints the still sprite once (it gets an
// outline and is cached); ANIM paints the small moving parts on top each frame.
import type { Kind } from "../world-types";
import { CUSTOMERS, LOOKS, drawBikeSide, person } from "./people";
import { C, Px, hash, textWidth } from "./px";

export type AnimCtx = {
  t: number;
  /** Seconds since the player last used it, or Infinity. */
  since: number;
  /** The player is within a few steps. */
  near: boolean;
  /** Its panel is open right now. */
  active: boolean;
  /** How much hair the barber's customer has left, and who it is. */
  cut: { customer: number; length: number };
  barberCutting: boolean;
};

const shelfItems = (g: Px, x: number, y: number, w: number, seed: number) => {
  let cx = x;
  let k = 0;
  while (cx < x + w - 2) {
    const h = hash(seed, k++);
    const iw = 2 + (h % 4), ih = 3 + ((h >> 3) % 4);
    const cols = ["#3d6fb5", "#c9a227", "#2f6b4f", "#b34a3a", "#8e959c", "#1e1e22", "#d9d0c0"];
    g.r(cx, y + 7 - ih, iw, ih, cols[h % cols.length]!);
    g.p(cx, y + 7 - ih, "rgba(255,255,255,0.35)");
    cx += iw + 1;
  }
};

export const BASE: Partial<Record<Kind, (g: Px) => void>> = {
  tree(g) {
    g.r(13, 26, 6, 11, C.bark); g.r(17, 26, 2, 11, C.barkS); g.p(12, 36, C.bark); g.p(19, 36, C.bark);
    g.disc(16, 17, 13, C.leaf0);
    g.disc(10, 19, 8, C.leaf1); g.disc(22, 17, 9, C.leaf1); g.disc(16, 11, 10, C.leaf1);
    g.disc(13, 9, 6, C.leaf2); g.disc(21, 12, 4, C.leaf2); g.disc(8, 16, 3, C.leaf2);
    for (let k = 0; k < 9; k++) { const h = hash(k, 3); g.p(6 + (h % 20), 3 + ((h >> 5) % 18), C.leaf3); }
  },
  pine(g) {
    g.r(9, 30, 4, 7, C.bark); g.r(11, 30, 2, 7, C.barkS);
    for (let i = 0; i < 4; i++) {
      const top = 1 + i * 7, half = 4 + i * 2;
      for (let row = 0; row < 10; row++) {
        const w = Math.round((row / 9) * half);
        g.r(11 - w, top + row, w * 2 + 1, 1, C.leaf1);
        g.r(11, top + row, w + 1, 1, C.leaf0);
        if (row > 2) g.p(11 - w, top + row, C.leaf2);
      }
    }
  },
  bush(g) {
    g.disc(8, 7, 6, C.leaf1); g.disc(4, 8, 4, C.leaf1); g.disc(12, 8, 4, C.leaf0);
    g.disc(6, 5, 2, C.leaf2); g.p(10, 4, C.leaf3); g.p(4, 9, "#c94a4a"); g.p(11, 6, "#c94a4a");
  },
  flowers(g) {
    const cols = ["#e6c45c", "#e8735e", "#d9dfe8", "#c58be0"];
    for (let k = 0; k < 7; k++) {
      const h = hash(k, 11);
      const x = 1 + (h % 14), y = 2 + ((h >> 4) % 7);
      g.p(x, y + 1, C.grass3); g.p(x, y, cols[k % cols.length]!);
    }
  },
  rock(g) {
    g.r(1, 2, 10, 6, "#6f6a66"); g.r(2, 1, 8, 2, "#8a8580"); g.p(3, 2, "#a5a09a"); g.r(1, 7, 10, 1, "#4e4a47");
  },
  lamp(g) {
    g.r(3, 8, 2, 23, C.metalD); g.r(3, 8, 1, 23, C.metalS);
    g.r(2, 29, 4, 5, C.metalD);
    g.r(1, 1, 6, 7, C.ink2); g.r(2, 3, 4, 4, C.light); g.r(2, 3, 4, 1, C.lightHi);
    g.r(1, 1, 6, 1, C.metalS); g.r(3, 0, 2, 1, C.metalS);
  },
  signpost(g) {
    g.r(8, 4, 2, 22, C.wood); g.r(9, 4, 1, 22, C.woodS);
    g.r(1, 3, 10, 5, C.woodHi); g.p(0, 5, C.woodHi); g.r(3, 5, 6, 1, C.woodD);
    g.r(8, 10, 9, 5, C.wood); g.p(17, 12, C.wood); g.r(9, 12, 6, 1, C.woodD);
    g.r(1, 16, 9, 4, C.woodHi); g.r(2, 17, 6, 1, C.woodD);
  },
  pole(g) { g.r(1, 0, 2, 34, C.woodS); g.r(1, 0, 1, 34, C.wood); g.r(0, 0, 4, 2, C.woodHi); },
  flags(g) {
    for (let x = 0; x < 178; x++) g.p(x, 2 + Math.round(Math.sin((Math.PI * x) / 177) * 9), "#bdb5a5");
  },
  bench(g) {
    g.r(1, 0, 26, 3, C.woodHi); g.r(1, 3, 26, 1, C.woodS);
    g.r(1, 5, 26, 3, C.wood); g.r(1, 8, 26, 1, C.woodS);
    g.r(2, 9, 2, 4, C.metalD); g.r(24, 9, 2, 4, C.metalD); g.r(2, 2, 1, 7, C.metalD); g.r(25, 2, 1, 7, C.metalD);
  },
  barberPole(g) {
    g.r(1, 20, 6, 4, C.metalS); g.r(1, 20, 6, 1, C.metalHi);
    g.r(1, 0, 6, 3, C.metalS); g.r(2, 0, 4, 1, C.metalHi);
    g.r(2, 3, 4, 17, C.white);
  },
  aboard(g) {
    g.r(1, 0, 12, 12, C.woodS); g.r(2, 1, 10, 10, "#262423");
    // chalk scissors
    g.p(4, 3, C.white); g.p(5, 4, C.white); g.p(6, 5, C.white); g.p(8, 3, C.white); g.p(7, 4, C.white);
    g.r(4, 7, 2, 2, C.white); g.r(8, 7, 2, 2, C.white); g.p(5, 6, C.white); g.p(8, 6, C.white);
    g.r(1, 12, 2, 4, C.woodS); g.r(11, 12, 2, 4, C.woodS);
  },
  cafe(g) {
    g.r(0, 0, 112, 40, "#3a3337");
    for (let y = 4; y < 40; y += 4) {
      g.r(0, y, 112, 1, "#2c272a");
      for (let x = (y / 4) % 2 ? 3 : 0; x < 112; x += 7) g.p(x, y - 2, "#463e43");
    }
    g.r(0, 0, 112, 3, "#4a4246");
    g.r(84, 2, 10, 14, C.brick0); g.r(83, 1, 12, 2, C.cap); g.r(85, 5, 8, 1, C.mortar);
    g.r(0, 38, 112, 3, C.ink2);
    g.r(0, 41, 112, 55, C.brick0);
    for (let y = 44; y < 96; y += 4) g.r(0, y, 112, 1, C.mortar);
    g.r(4, 43, 104, 52, "#1d3a31");
    g.r(10, 44, 92, 9, "#16302a"); g.text("COFFEE", 56 - textWidth("COFFEE") / 2, 46, C.lightHi);
    // shopfront glass, warm inside
    g.r(8, 60, 40, 30, "#e7b867"); g.r(72, 60, 32, 30, "#e7b867");
    g.r(8, 60, 40, 3, "#c99852"); g.r(72, 60, 32, 3, "#c99852");
    g.r(27, 60, 2, 30, "#1d3a31"); g.r(87, 60, 2, 30, "#1d3a31");
    g.r(10, 80, 36, 4, "#7a4a2a"); g.r(74, 80, 28, 4, "#7a4a2a");
    for (const x of [13, 19, 33, 40, 78, 95]) { g.r(x, 76, 3, 4, C.white); g.p(x + 3, 77, C.white); }
    g.r(52, 58, 16, 37, "#2a1f1a"); g.r(55, 62, 10, 14, "#e7b867"); g.p(64, 78, C.light);
    // awning
    for (let x = 0; x < 112; x += 8) { g.r(x, 53, 4, 6, C.red); g.r(x + 4, 53, 4, 6, C.white); }
    for (let x = 0; x < 112; x += 4) g.p(x + 1, 59, x % 8 ? C.white : C.red);
  },
  cafeTable(g) {
    g.r(1, 5, 5, 8, C.woodS); g.r(20, 5, 5, 8, C.woodS); g.r(1, 5, 5, 2, C.wood); g.r(20, 5, 5, 2, C.wood);
    g.disc(13, 6, 5, C.whiteS); g.disc(13, 5, 5, C.white);
    g.r(12, 10, 2, 5, C.metalD);
    g.r(10, 3, 3, 3, C.white); g.p(10, 3, C.woodS); g.r(15, 5, 2, 2, "#b5793f");
  },
  tower(g) {
    g.r(3, 50, 16, 20, C.stone); g.r(15, 50, 4, 20, C.stoneS);
    for (let y = 52; y < 70; y += 4) g.r(5, y, 10, 1, C.stoneS);
    g.r(4, 22, 14, 30, C.stone); g.r(14, 22, 4, 30, C.stoneS);
    for (let x = 6; x < 14; x += 3) g.r(x, 26, 1, 24, C.stoneHi);
    g.r(3, 13, 16, 10, C.stone); g.r(15, 13, 4, 10, C.stoneS);
    g.disc(11, 18, 4, "#efe2b8"); g.p(11, 16, C.ink); g.p(11, 17, C.ink); g.p(12, 18, C.ink);
    g.r(5, 8, 12, 5, C.stoneS); g.r(7, 9, 2, 3, C.ink2); g.r(13, 9, 2, 3, C.ink2);
    for (let row = 0; row < 8; row++) { const w = Math.round(row * 0.8); g.r(11 - w, row, w * 2 + 1, 1, row % 2 ? "#3b3a3f" : "#4a4950"); }
    g.p(11, 0, C.amber); g.p(4, 7, C.stoneHi); g.p(18, 7, C.stoneHi);
  },
  phonebox(g) {
    g.r(0, 2, 14, 26, C.bus); g.r(11, 2, 3, 26, C.busS); g.r(0, 0, 14, 3, C.busS); g.r(3, 0, 8, 1, C.busHi);
    g.r(2, 4, 10, 2, C.ink2); g.r(4, 5, 6, 1, C.white);
    g.r(2, 8, 9, 16, "#f3d9a0");
    for (let y = 8; y < 24; y += 4) g.r(2, y, 9, 1, C.bus);
    g.r(5, 8, 1, 16, C.bus); g.r(8, 8, 1, 16, C.bus);
  },
  bus(g) {
    g.r(0, 0, 72, 12, C.busHi); g.r(2, 2, 68, 8, C.bus); g.r(30, 4, 14, 4, C.busS);
    g.r(0, 12, 72, 18, C.bus); g.r(0, 27, 72, 3, C.busS);
    g.r(3, 13, 60, 6, "#25303d");
    for (let x = 3; x < 63; x += 9) { g.r(x, 13, 1, 6, C.bus); if (hash(x, 1) % 2) g.r(x + 2, 14, 5, 4, "#f2d48f"); }
    g.r(12, 21, 48, 5, "#25303d");
    for (let x = 12; x < 60; x += 8) g.r(x, 21, 1, 5, C.bus);
    g.r(4, 21, 6, 9, "#1c2430");
    g.r(64, 13, 7, 15, "#33414f"); g.r(65, 13, 5, 3, C.light);
    g.r(8, 28, 12, 6, C.ink2); g.r(50, 28, 12, 6, C.ink2); g.r(11, 30, 6, 2, C.metalS); g.r(53, 30, 6, 2, C.metalS);
    g.r(70, 24, 2, 2, C.lightHi);
  },
  cab(g) {
    g.r(8, 0, 18, 8, "#2b2b32"); g.r(14, 0, 6, 2, C.amber);
    g.r(9, 2, 6, 5, "#3a4a5a"); g.r(19, 2, 6, 5, "#3a4a5a");
    g.r(0, 7, 34, 11, "#1c1c21"); g.r(0, 7, 34, 1, "#33333b");
    g.r(4, 16, 7, 6, C.ink2); g.r(23, 16, 7, 6, C.ink2); g.r(6, 18, 3, 2, C.metalS); g.r(25, 18, 3, 2, C.metalS);
    g.r(32, 10, 2, 2, C.lightHi); g.r(0, 10, 1, 2, C.red);
  },
  bikerack(g) {
    drawBikeSide(g.at(2, 0), 1, "#c9a227", "#8f7419");
    for (const x of [1, 14]) { g.r(x, 6, 1, 9, C.metalS); g.r(x + 10, 6, 1, 9, C.metalS); g.r(x, 6, 11, 1, C.metalHi); }
    g.r(0, 15, 28, 1, C.metalD);
  },
  roundel(g) {
    g.r(5, 10, 2, 18, C.metalD);
    g.disc(6, 5, 5, C.bus); g.disc(6, 5, 3, C.white);
    g.r(0, 4, 12, 3, C.blue);
  },
  bin(g) { g.r(0, 2, 8, 10, "#2d3a32"); g.r(0, 0, 8, 3, "#3c4b41"); g.r(1, 5, 1, 6, "#3c4b41"); },
  ducks(g) {
    g.disc(8, 22, 3, "#2f6b3a"); g.p(8, 21, C.water0); g.disc(48, 8, 2, "#2f6b3a");
  },

  himalaya(g) {
    // three snow-capped peaks: the tallest behind, two in front
    const peak = (cx: number, top: number, hw: number, rock: string, shade: string, snow: string, snowS: string) => {
      for (let y = top; y < 44; y++) {
        const k = (y - top) / (44 - top), half = Math.round(k * hw);
        const line = 8 + (hash(cx, y) % 4);
        const snowy = y - top < line;
        g.r(cx - half, y, half + 1, 1, snowy ? snow : rock);
        g.r(cx + 1, y, half, 1, snowy ? snowS : shade);
        if (!snowy && hash(cx, y, 2) % 5 === 0) g.p(cx - half + 2 + (hash(y, cx) % Math.max(1, half)), y, snowS);
      }
    };
    peak(84, 0, 56, "#5d6a82", "#434c60", "#eef2f7", "#b9c4d4");
    peak(36, 12, 38, "#6b7891", "#4c566b", "#e6ecf3", "#aeb9ca");
    peak(128, 9, 34, "#66738b", "#485267", "#e9eef4", "#b2bdcd");
    g.r(0, 40, 160, 8, "#2f4a33"); g.r(0, 40, 160, 1, "#3b5b3d");
    for (let x = 2; x < 158; x += 5) g.p(x + (hash(x) % 3), 39, "#2f4a33");
  },
  stupa(g) {
    g.r(1, 30, 28, 8, "#d6cfc1"); g.r(1, 30, 28, 1, "#ece6da"); g.r(1, 34, 28, 1, "#b8b0a2");
    g.r(4, 26, 22, 4, "#e9e3d6"); g.r(4, 29, 22, 1, "#b8b0a2");
    for (let y = 15; y < 27; y++) {
      const half = Math.round(Math.sqrt(Math.max(0, 121 - (26 - y) ** 2)));
      g.r(15 - half, y, half, 1, "#f2ede3"); g.r(15, y, half + 1, 1, "#d2cabb");
    }
    g.r(10, 9, 11, 6, "#d6ae45"); g.r(10, 9, 11, 1, "#ecc965"); g.r(10, 14, 11, 1, "#a8842e");
    // the eyes of the Buddha, and the question-mark nose
    g.r(11, 11, 3, 1, "#1d2a52"); g.r(17, 11, 3, 1, "#1d2a52"); g.p(12, 12, "#1d2a52"); g.p(18, 12, "#1d2a52");
    g.p(15, 12, "#8f1d10"); g.p(15, 13, "#8f1d10");
    for (let i = 0; i < 8; i++) { const w = 4 - Math.floor(i / 2); g.r(15 - w + 1, 8 - i, w * 2 - 1, 1, i % 2 ? "#e2bd52" : "#b8902f"); }
    g.p(15, 0, "#f3d97a");
  },
  momoStall(g) {
    // Nepal's flag on the corner post
    g.r(36, -8, 1, 13, C.metalS);
    for (let i = 0; i < 4; i++) g.r(37, -8 + i, 4 - i, 1, "#c8102e");
    for (let i = 0; i < 4; i++) g.r(37, -4 + i, 4 - i, 1, "#c8102e");
    g.p(37, -8, "#22408f"); g.p(37, -4, "#22408f"); g.p(37, -1, "#22408f"); g.p(38, -6, C.white);
    g.r(3, 4, 2, 16, C.woodS); g.r(35, 4, 2, 16, C.woodS);
    for (let x = 0; x < 40; x += 6) { g.r(x, 1, 3, 6, "#c8102e"); g.r(x + 3, 1, 3, 6, "#22408f"); }
    for (let x = 0; x < 40; x += 3) g.p(x + 1, 7, "#c8102e");
    g.box(1, 18, 38, 12, 4, C.woodHi, C.wood);
    g.r(1, 22, 38, 1, "#c8102e"); g.r(10, 23, 20, 7, "#f1e6c8"); g.text("MOMO", 20 - Math.floor(textWidth("MOMO") / 2), 24, "#c8102e");
    g.r(5, 12, 11, 7, "#c9a46a"); g.r(5, 14, 11, 1, "#9c7a45"); g.r(5, 17, 11, 1, "#9c7a45"); g.r(6, 11, 9, 2, "#dcb87c");
    g.r(18, 13, 10, 6, "#c9a46a"); g.r(18, 15, 10, 1, "#9c7a45"); g.r(19, 12, 8, 2, "#dcb87c");
    g.r(29, 17, 9, 2, C.white);
    for (const x of [30, 33, 36]) { g.r(x, 15, 2, 2, "#f3ead6"); g.p(x, 15, "#d8ccb2"); }
    g.r(34, 18, 3, 1, "#c8461e");
    g.disc(7, 31, 3, C.ink2); g.p(7, 31, C.metalS); g.disc(33, 31, 3, C.ink2); g.p(33, 31, C.metalS);
  },
  pegboard(g) {
    g.r(0, 0, 44, 20, "#8b6a4a");
    for (let y = 2; y < 20; y += 4) for (let x = 2; x < 44; x += 4) g.p(x, y, "#6a4f35");
    g.r(4, 3, 2, 6, C.red); g.r(4, 9, 2, 5, C.metalHi);
    g.r(9, 3, 2, 6, "#2f56b8"); g.r(9, 9, 2, 6, C.metalHi);
    g.r(14, 4, 3, 2, C.metal); g.r(15, 6, 1, 8, C.metal); g.r(14, 13, 3, 2, C.metal);
    g.r(20, 4, 1, 9, C.metalS); g.r(23, 4, 1, 9, C.metalS); g.r(20, 12, 4, 3, C.red);
    g.r(29, 4, 9, 12, "#e5b53a"); g.r(30, 5, 7, 4, "#2a2e22"); g.p(31, 6, C.green); g.p(33, 6, C.green); g.p(33, 11, C.ink); g.r(31, 13, 5, 1, C.ink2);
    g.disc(41, 9, 2, "#b0b4b8"); g.p(41, 9, "#5e646a");
  },
  pane(g) {
    g.r(0, 0, 22, 18, C.wood); g.r(2, 2, 18, 13, "#1d2b44");
    g.p(5, 4, C.lightHi); g.p(14, 6, C.white); g.p(8, 9, C.whiteS); g.disc(15, 4, 1, "#f3ead0");
    g.r(10, 2, 2, 13, C.wood); g.r(2, 8, 18, 1, C.wood);
    g.r(0, 15, 22, 3, C.woodHi);
  },
  shelf(g) {
    g.r(0, 0, 30, 34, C.woodS); g.r(2, 2, 26, 30, "#3d2a1f");
    for (const y of [2, 11, 20]) { shelfItems(g, 3, y, 25, y); g.r(2, y + 7, 26, 2, C.wood); }
    g.r(0, 0, 30, 2, C.woodHi);
    g.r(2, 29, 26, 3, C.woodD);
  },
  workbench(g) {
    g.r(0, 0, 44, 9, C.oak); g.r(0, 0, 44, 1, C.oakHi);
    g.r(0, 9, 44, 12, C.oakS); g.r(0, 9, 44, 1, C.ink2);
    g.r(3, 12, 12, 6, "#5d4535"); g.r(8, 14, 3, 1, C.metalHi);
    g.r(29, 12, 12, 6, "#5d4535"); g.r(34, 14, 3, 1, C.metalHi);
    g.r(1, 21, 3, 3, C.woodD); g.r(40, 21, 3, 3, C.woodD);
    g.r(3, 2, 18, 6, "#2f6b4f"); for (let x = 5; x < 21; x += 3) g.r(x, 2, 1, 6, "#3d7d5e");
    // desk lamp on the right
    g.r(37, 6, 5, 2, C.metalD); g.line(39, 6, 36, 1, C.metalS); g.line(36, 1, 31, 0, C.metalS); g.r(29, 0, 4, 2, C.red);
    g.r(16, 6, 6, 1, C.red); g.r(22, 6, 3, 1, C.metalHi);
  },
  stool(g) { g.r(1, 0, 6, 3, C.woodHi); g.r(1, 2, 6, 1, C.wood); g.r(1, 3, 1, 6, C.woodS); g.r(6, 3, 1, 6, C.woodS); g.r(1, 6, 6, 1, C.woodS); },
  solder(g) {
    g.box(0, 6, 22, 14, 5, C.wood, C.woodS, C.woodHi);
    g.r(1, 18, 2, 2, C.woodD); g.r(19, 18, 2, 2, C.woodD);
    g.r(2, 1, 9, 7, "#c9a227"); g.r(3, 2, 5, 2, "#3b1212"); g.p(4, 3, C.red); g.p(6, 3, C.red); g.r(3, 5, 2, 2, C.ink2);
    g.r(13, 3, 4, 5, C.metalS); g.r(14, 0, 2, 4, C.metalHi);
    g.r(18, 5, 3, 3, "#3d6fb5");
  },
  cabinet(g) {
    g.r(0, 0, 18, 26, "#4a5a6a"); g.r(0, 0, 18, 1, "#6c7d8e");
    for (let y = 2; y < 24; y += 4) for (let x = 1; x < 17; x += 4) { g.r(x, y, 3, 3, "#5f7183"); g.p(x + 1, y + 1, hash(x, y) % 2 ? C.amber : C.whiteS); }
  },
  crate(g) {
    g.r(0, 0, 16, 14, C.wood); g.r(0, 0, 16, 4, C.woodHi);
    g.r(2, 0, 4, 3, "#1e1e22"); g.r(7, 1, 3, 2, "#2c2f36"); g.r(11, 0, 4, 3, "#1e1e22"); g.p(3, 1, C.glowS);
    g.r(0, 7, 16, 1, C.woodS); g.r(0, 11, 16, 1, C.woodS);
  },
  boxes(g) {
    g.box(0, 8, 18, 12, 5, "#b58a5a", "#8d6a43"); g.r(8, 8, 2, 5, "#d5b07a");
    g.box(3, 0, 12, 9, 4, "#c09363", "#987149"); g.r(8, 0, 2, 4, "#d5b07a");
  },
  rugRed(g) {
    g.r(0, 0, 56, 32, "#6e261c"); g.r(2, 2, 52, 28, "#9a3f2b"); g.r(5, 5, 46, 22, "#6e261c");
    for (let x = 10; x < 50; x += 10) { g.p(x, 16, "#d0783f"); g.p(x - 1, 15, "#d0783f"); g.p(x + 1, 17, "#d0783f"); }
    for (let y = 1; y < 32; y += 3) { g.p(0, y, C.whiteS); g.p(55, y, C.whiteS); }
  },

  whiteboard(g) {
    g.r(0, 0, 44, 22, C.metalS); g.r(1, 1, 42, 17, "#e9ecef");
    g.r(4, 4, 8, 5, "#3a6ad1"); g.r(5, 5, 6, 3, "#e9ecef");
    g.r(18, 4, 9, 5, "#d33a2c"); g.r(19, 5, 7, 3, "#e9ecef");
    g.r(32, 10, 8, 5, "#2f8f5b"); g.r(33, 11, 6, 3, "#e9ecef");
    g.line(12, 6, 17, 6, "#333"); g.line(27, 7, 35, 10, "#333"); g.line(8, 9, 8, 14, "#333"); g.line(8, 14, 31, 13, "#333");
    g.r(2, 19, 40, 2, C.metal); g.p(8, 19, "#d33a2c"); g.p(10, 19, "#3a6ad1"); g.p(12, 19, C.ink);
  },
  poster(g) {
    g.r(0, 0, 24, 20, "#18202d");
    const nodes = [[4, 4], [12, 3], [19, 6], [7, 12], [16, 14], [11, 8]];
    g.line(4, 4, 11, 8, C.glowS); g.line(12, 3, 11, 8, C.glowS); g.line(19, 6, 11, 8, C.glowS); g.line(7, 12, 11, 8, C.glowS); g.line(16, 14, 11, 8, C.glowS);
    for (const [x, y] of nodes) g.r(x! - 1, y! - 1, 2, 2, C.glow);
    g.r(10, 7, 3, 3, C.red);
  },
  rack(g) {
    g.r(0, 0, 22, 44, "#1b1e23"); g.r(0, 0, 22, 2, "#2e333b");
    g.r(2, 3, 18, 38, "#23272e");
    for (let y = 4; y < 38; y += 5) { g.r(3, y, 16, 4, "#2e333b"); for (let x = 10; x < 18; x += 2) g.r(x, y + 1, 1, 2, "#1b1e23"); }
    g.r(1, 41, 4, 3, C.ink2); g.r(17, 41, 4, 3, C.ink2);
  },
  devdesk(g) {
    g.r(6, 0, 18, 12, C.ink2); g.r(7, 1, 16, 9, C.screen); g.r(14, 12, 2, 2, C.metalD);
    g.r(28, 0, 18, 12, C.ink2); g.r(29, 1, 16, 9, C.screen); g.r(36, 12, 2, 2, C.metalD);
    g.box(0, 10, 52, 16, 6, C.oak, C.oakS, C.oakHi);
    g.r(2, 22, 3, 4, C.woodD); g.r(47, 22, 3, 4, C.woodD);
    g.r(13, 12, 17, 3, "#2c2f36"); for (let x = 14; x < 29; x += 2) g.p(x, 13, "#4a4f58");
    g.r(32, 12, 2, 3, "#2c2f36");
    g.r(42, 11, 4, 4, C.white); g.r(42, 13, 4, 1, C.red); g.p(46, 12, C.white);
    g.r(3, 11, 6, 3, "#f0e6a8");
  },
  chair(g) {
    g.r(2, 0, 8, 9, "#2a2d35"); g.r(2, 0, 8, 1, "#3d414c"); g.r(3, 2, 6, 5, "#30343d");
    g.r(1, 9, 10, 3, "#30343d"); g.r(5, 12, 2, 2, C.metalD);
    g.r(1, 14, 2, 1, C.metalD); g.r(9, 14, 2, 1, C.metalD); g.p(5, 15, C.metalD);
  },
  laptopdesk(g) {
    g.box(0, 6, 38, 16, 6, C.oak, C.oakS, C.oakHi);
    g.r(2, 18, 3, 4, C.woodD); g.r(33, 18, 3, 4, C.woodD);
    g.r(12, 6, 14, 4, C.metal); g.r(12, 6, 14, 1, C.metalHi); for (let x = 13; x < 25; x += 2) g.p(x, 8, C.metalS);
    g.r(13, -3, 12, 9, C.metalD); g.r(14, -2, 10, 7, "#10161c");
    g.r(30, 7, 5, 4, C.white); g.r(31, 8, 3, 1, "#bdb5a5");
    g.r(3, 8, 6, 3, "#3b5f8a");
  },
  plant(g) {
    g.r(3, 13, 6, 7, "#b0653d"); g.r(2, 13, 8, 2, "#c97a4b"); g.r(7, 15, 2, 5, "#8f4f2e");
    g.disc(4, 8, 3, C.leaf1); g.disc(8, 6, 3, C.leaf2); g.disc(6, 3, 3, C.leaf1); g.p(5, 2, C.leaf3); g.p(9, 5, C.leaf3);
  },
  sofa(g) {
    g.r(0, 0, 36, 8, "#3d4766"); g.r(2, 1, 32, 5, "#4a5578");
    g.r(2, 8, 32, 8, "#56628a"); g.r(17, 8, 1, 8, "#3d4766"); g.r(2, 8, 32, 1, "#6a77a0");
    g.r(0, 4, 4, 14, "#3d4766"); g.r(32, 4, 4, 14, "#3d4766");
    g.r(1, 18, 2, 2, C.woodD); g.r(33, 18, 2, 2, C.woodD);
    g.r(6, 9, 6, 4, C.red);
  },
  rugBlue(g) {
    g.r(0, 0, 60, 34, "#28385a"); g.r(3, 3, 54, 28, "#33496f");
    for (let x = 6; x < 56; x += 6) for (let y = 6; y < 30; y += 6) g.p(x, y, "#4b6596");
  },

  mirror(g) {
    g.r(0, 0, 26, 22, "#b58a3a"); g.r(2, 3, 22, 17, "#6c8796");
    g.line(5, 17, 13, 5, "#9fbccb"); g.line(9, 18, 18, 6, "#88a6b6");
    for (let x = 3; x < 24; x += 5) g.r(x, 0, 2, 2, C.lightHi);
  },
  counter(g) {
    g.r(0, 0, 30, 4, "#dcd3c3"); g.r(0, 0, 30, 1, "#f0e9dc"); g.r(0, 4, 30, 6, "#2a2523");
    g.r(2, -3, 2, 4, "#3d6fb5"); g.r(5, -2, 2, 3, C.amber); g.r(9, -1, 4, 2, C.metalHi);
    g.r(22, -3, 3, 4, "#7fb3c8"); g.p(23, -4, C.ink); g.p(24, -4, C.white);
  },
  barberChair(g) {
    g.r(4, 18, 10, 4, C.metalS); g.r(4, 18, 10, 1, C.metalHi);
    g.r(8, 15, 2, 3, C.metal);
    g.r(2, 11, 14, 5, C.leatherS);
    g.r(0, 10, 3, 4, C.metalD); g.r(15, 10, 3, 4, C.metalD); g.r(0, 10, 3, 1, C.metalHi); g.r(15, 10, 3, 1, C.metalHi);
    g.r(3, 2, 12, 10, C.leather); g.r(3, 2, 12, 1, "#b0362a");
    for (const [x, y] of [[6, 5], [11, 5], [6, 9], [11, 9], [8, 7]]) g.p(x!, y!, C.leatherS);
    g.r(6, 0, 6, 3, C.leather); g.r(7, 0, 4, 1, "#b0362a");
  },
  barberChairEmpty(g) { BASE.barberChair!(g); },
  reception(g) {
    g.r(0, 4, 44, 6, "#dcd3c3"); g.r(0, 4, 44, 1, "#f0e9dc");
    g.r(0, 10, 44, 14, "#2a2523"); g.r(0, 15, 44, 2, C.red);
    g.p(20, 12, C.white); g.p(22, 12, C.white); g.p(21, 13, C.white); g.r(20, 19, 2, 2, C.white); g.r(23, 19, 2, 2, C.white);
    g.r(26, -6, 14, 10, C.ink2); g.r(27, -5, 12, 7, "#e9edf2"); g.r(32, 4, 4, 1, C.metalD);
    g.r(8, 2, 5, 4, C.ink2); g.p(10, 3, C.green);
    g.r(14, 1, 8, 4, C.white); g.r(15, 2, 6, 1, "#bdb5a5");
  },
  waiting(g) {
    g.r(0, 0, 40, 7, "#3d3532"); g.r(0, 0, 40, 1, "#574c47");
    g.r(1, 7, 38, 6, "#5a4c45"); g.r(13, 7, 1, 6, "#3d3532"); g.r(26, 7, 1, 6, "#3d3532");
    g.r(2, 13, 2, 5, C.metalD); g.r(36, 13, 2, 5, C.metalD);
  },
  productShelf(g) {
    g.r(0, 0, 16, 30, C.woodS); g.r(1, 1, 14, 28, "#3a281e");
    for (const y of [1, 10, 19]) {
      g.r(1, y + 7, 14, 2, C.wood);
      for (let x = 2; x < 14; x += 3) { const h = hash(x, y); g.r(x, y + 3, 2, 4, ["#2f2a2a", "#c9a227", "#3d6fb5", "#b34a3a"][h % 4]!); g.p(x, y + 3, "rgba(255,255,255,0.4)"); }
    }
  },
  coffeeTable(g) {
    g.r(0, 2, 18, 6, "#4a3a33"); g.r(0, 2, 18, 1, "#5f4c43");
    g.r(3, 2, 6, 4, "#d9c7a0"); g.r(9, 3, 6, 3, "#7fb3c8");
    g.r(1, 8, 2, 4, C.woodD); g.r(15, 8, 2, 4, C.woodD);
  },
  pricelist(g) {
    g.r(0, 0, 22, 18, C.woodS); g.r(1, 1, 20, 16, "#262626");
    for (let y = 3; y < 16; y += 3) { g.r(3, y, 9 + (hash(y) % 4), 1, C.whiteS); g.r(16, y, 3, 1, C.amber); }
  },

  bookshelf(g) {
    g.r(0, 0, 30, 34, C.woodS); g.r(2, 2, 26, 30, "#2f2119");
    for (const y of [2, 11, 20]) {
      let x = 3;
      while (x < 27) {
        const h = hash(x, y, 9);
        const w = 1 + (h % 3), ht = 5 + ((h >> 3) % 3);
        g.r(x, y + 7 - ht, w, ht, ["#7a2a22", "#2f4f7a", "#2f6b4f", "#c9a227", "#d9d0c0", "#4a3a6a"][h % 6]!);
        x += w + (h % 5 === 0 ? 1 : 0);
      }
      g.r(2, y + 7, 26, 2, C.wood);
    }
    g.r(0, 0, 30, 2, C.woodHi);
  },
  banner(g) {
    g.r(0, 0, 52, 12, "#1f2a44"); g.r(0, 0, 52, 1, "#33426a"); g.r(0, 11, 52, 1, C.amber);
    g.text("NORTHUMBRIA", 26 - Math.floor(textWidth("NORTHUMBRIA") / 2), 4, C.white);
  },
  apostroPoster(g) {
    g.r(0, 0, 22, 20, "#151112"); g.r(0, 0, 22, 1, C.red); g.r(0, 19, 22, 1, C.red);
    // the A mark
    for (let row = 0; row < 11; row++) { const w = Math.round(row * 0.45); g.p(11 - w, 3 + row, C.red); g.p(11 + w, 3 + row, C.red); g.p(10 - w, 3 + row, C.red); g.p(12 + w, 3 + row, C.red); }
    g.r(8, 10, 7, 1, C.red);
  },
  studydesk(g) {
    g.box(0, 6, 40, 16, 6, "#8c6a4a", "#5f4634", "#a5805c");
    g.r(2, 18, 3, 4, C.woodD); g.r(35, 18, 3, 4, C.woodD);
    g.r(2, 1, 8, 2, "#2f4f7a"); g.r(3, 3, 7, 2, "#7a2a22"); g.r(2, 5, 8, 2, "#2f6b4f");
    g.r(14, 3, 12, 6, C.white); g.r(20, 3, 1, 6, C.whiteS); g.text("AI", 15, 4, C.red); g.r(22, 5, 3, 1, "#9a9384"); g.r(22, 7, 3, 1, "#9a9384");
    g.r(30, 6, 3, 3, C.white); g.r(30, 7, 3, 1, C.red);
    g.r(34, 0, 1, 7, C.metalS); g.r(32, -1, 5, 2, C.amber);
  },
  pcdesk(g) {
    g.r(8, -8, 22, 15, C.ink2); g.r(9, -7, 20, 11, "#140e0e"); g.r(18, 7, 2, 2, C.metalD);
    g.box(0, 8, 38, 16, 6, C.oak, C.oakS, C.oakHi);
    g.r(2, 20, 3, 4, C.woodD); g.r(33, 20, 3, 4, C.woodD);
    g.r(10, 10, 16, 3, "#2c2f36"); for (let x = 11; x < 25; x += 2) g.p(x, 11, "#4a4f58");
    g.r(28, 10, 2, 3, "#2c2f36");
  },
};

// ---------- Moving parts ----------

const codeLines = (g: Px, x: number, y: number, w: number, rows: number, scroll: number, seed: number) => {
  const cols = [C.code1, C.code2, C.code3, C.code4];
  for (let i = 0; i < rows; i++) {
    const n = Math.floor(scroll) + i;
    const h = hash(n, seed);
    const indent = (h % 3) * 2;
    g.r(x + indent, y + i * 2, Math.min(w - indent, 3 + ((h >> 3) % (w - 3))), 1, cols[(h >> 7) % 4]!);
  }
};

export const ANIM: Partial<Record<Kind, (g: Px, a: AnimCtx) => void>> = {
  flags(g, a) {
    const cols = ["#3a6ad1", "#efe9dc", "#d33a2c", "#2f8f5b", "#e6c45c"];
    for (let i = 0; i < 18; i++) {
      const x = 4 + i * 9.6, y = 3 + Math.round(Math.sin((Math.PI * x) / 177) * 9);
      const sway = Math.round(Math.sin(a.t * 2.4 + i * 0.7));
      g.r(Math.round(x), y, 6, 5, cols[i % 5]!);
      g.r(Math.round(x) + sway, y + 5, 6, 2, cols[i % 5]!);
      g.r(Math.round(x), y, 6, 1, "rgba(0,0,0,0.15)");
    }
  },
  momoStall(g, a) {
    for (const [sx, phase] of [[10, 0], [22, 0.5]] as const) for (let i = 0; i < 3; i++) {
      const k = (a.t * 0.55 + i / 3 + phase) % 1;
      g.p(sx + Math.round(Math.sin(a.t * 2.2 + i * 2 + sx) * 1.5), 10 - Math.round(k * 12), `rgba(235,235,235,${0.6 - k * 0.55})`);
    }
  },
  stupa(g, a) {
    // a lamp flickers on the terrace
    g.p(4, 28, Math.sin(a.t * 8) > 0 ? C.lightHi : C.light);
    g.p(25, 28, Math.sin(a.t * 7 + 1) > 0 ? C.lightHi : C.light);
  },
  barberPole(g, a) {
    for (let row = 0; row < 17; row++) for (let col = 0; col < 4; col++) {
      const k = (((row + col + Math.floor(a.t * 7)) % 6) + 6) % 6;
      g.p(2 + col, 3 + row, k < 2 ? C.red : k === 3 || k === 4 ? C.blue : C.white);
    }
    g.r(5, 3, 1, 17, "rgba(0,0,0,0.2)");
  },
  lamp(g, a) {
    const f = Math.sin(a.t * 9) > 0.96 ? C.light : C.lightHi;
    g.r(2, 3, 4, 1, f);
  },
  ducks(g, a) {
    const duck = (x: number, y: number, flip: boolean) => {
      g.r(x - 3, y + 3, 8, 1, C.water1);
      g.r(x, y + 1, 5, 3, "#e9e1cc"); g.r(x, y + 3, 5, 1, "#bdb29a");
      const hx = flip ? x - 1 : x + 4;
      g.r(hx, y - 1, 2, 2, "#2f6b3a"); g.p(flip ? hx - 1 : hx + 2, y, C.amber);
    };
    const t = a.t;
    duck(20 + Math.round(Math.sin(t * 0.4) * 12), 8 + Math.round(Math.sin(t * 0.7) * 2), Math.cos(t * 0.4) < 0);
    duck(36 + Math.round(Math.sin(t * 0.33 + 2) * 10), 16 + Math.round(Math.cos(t * 0.5) * 2), Math.cos(t * 0.33 + 2) < 0);
  },
  tower(g, a) {
    const m = (a.t / 8) * Math.PI * 2;
    g.line(11, 18, 11 + Math.round(Math.cos(m) * 2), 18 + Math.round(Math.sin(m) * 2), C.ink);
  },
  workbench(g, a) {
    // the phone being repaired
    const s = a.since;
    const fixed = s >= 3.4 && s !== Infinity;
    g.r(8, 2, 5, 7, C.ink2);
    if (s < 1.2) {
      g.r(9, 3, 3, 5, "#0b0f12"); g.line(9, 7, 11, 3, C.metalS);
      const sx = 13 + Math.round(Math.sin(s * 20)), sy = 1;
      g.r(sx, sy, 1, 4, C.metalHi); g.r(sx, sy + 4, 1, 3, C.red);
      if (Math.sin(s * 30) > 0.3) g.p(12, 5, C.lightHi);
    } else if (s < 2.4) {
      g.r(9, 3, 3, 5, "#2f6b4f"); g.p(9, 4, C.amber); g.p(11, 6, C.metalHi); g.p(10, 5, C.code2);
      g.r(14, 3, 4, 5, "#0b0f12");
    } else if (s < 3.4) {
      const k = Math.min(1, (s - 2.4) * 2);
      g.r(9, 3, 3, 5, k > 0.5 ? C.glow : C.glowS);
      g.p(10, 5, C.white); g.p(9, 6, C.green); g.p(10, 7, C.green); g.p(11, 5, C.green);
    } else if (fixed) {
      g.r(9, 3, 3, 5, C.glowS); g.p(10, 4, C.glow);
    } else {
      g.r(9, 3, 3, 5, "#0b0f12"); g.line(9, 7, 11, 3, C.metalS); g.p(10, 4, "#2c3640");
    }
    // the laptop opens when you come close
    const open = a.near ? 1 : 0;
    g.r(24, 4, 12, 3, C.metal); g.r(24, 4, 12, 1, C.metalHi);
    if (open) { g.r(25, -4, 10, 8, C.metalD); g.r(26, -3, 8, 6, a.active ? C.glow : C.glowS); g.r(27, -2, 4, 1, C.white); g.r(27, 0, 6, 1, C.screen); }
    else { g.r(24, 2, 12, 2, C.metalS); }
    // a glint off the screwdriver
    if (a.t % 3.2 < 0.15) g.p(24 - 1, 6, C.lightHi);
  },
  solder(g, a) {
    for (let i = 0; i < 3; i++) {
      const k = (a.t * 0.5 + i / 3) % 1;
      const x = 15 + Math.round(Math.sin(a.t * 2 + i * 2) * 1.5 + k * 2), y = -1 - Math.round(k * 9);
      g.p(x, y, k < 0.5 ? "rgba(220,220,230,0.55)" : "rgba(220,220,230,0.25)");
    }
  },
  rack(g, a) {
    for (let y = 4, u = 0; y < 38; y += 5, u++) for (let l = 0; l < 3; l++) {
      const on = hash(u, l, Math.floor(a.t * (3 + l))) % 3 !== 0;
      g.p(4 + l * 2, y + 1, on ? (l === 2 ? C.amber : C.green) : "#1e3324");
    }
  },
  devdesk(g, a) {
    codeLines(g, 8, 2, 13, 4, a.t * 2.2, 1);
    codeLines(g, 30, 2, 13, 4, a.t * 1.3, 2);
    for (let i = 0; i < 2; i++) {
      const k = (a.t * 0.6 + i / 2) % 1;
      g.p(43 + Math.round(Math.sin(a.t * 3 + i) * 1), 9 - Math.round(k * 7), `rgba(230,230,230,${0.5 - k * 0.45})`);
    }
  },
  laptopdesk(g, a) {
    if (a.active || a.since < 2) {
      g.r(14, -2, 10, 7, "#0d1820");
      codeLines(g, 15, -1, 8, 3, a.t * 3, 7);
      if (a.t % 1 < 0.5) g.p(15, 4, C.green);
    } else {
      if (a.t % 3 < 1.5) g.p(18, 7, C.green);
    }
  },
  reception(g, a) {
    for (let i = 0; i < 4; i++) for (let j = 0; j < 3; j++) {
      const booked = hash(i, j, Math.floor(a.t / 1.5)) % 3 === 0;
      g.r(28 + i * 3, -4 + j * 2, 2, 1, booked ? C.red : "#bfc6cf");
    }
  },
  barberChair(g, a) {
    // the customer, seen from behind, mid-haircut
    const c = CUSTOMERS[a.cut.customer]!;
    g.r(1, 5, 3, 8, C.white); g.r(14, 5, 3, 8, C.white); g.r(3, 3, 12, 3, C.white);
    g.r(5, -5, 8, 9, c.skin); g.r(4, -3, 1, 2, c.skin); g.r(13, -3, 1, 2, c.skin);
    const L = a.cut.length;
    if (L === 2) { g.r(5, -6, 8, 8, c.hair); g.r(4, -5, 10, 5, c.hair); g.r(6, 2, 6, 1, c.hair); }
    else if (L === 1) { g.r(5, -6, 8, 6, c.hair); g.r(4, -5, 10, 3, c.hair); g.r(5, 0, 8, 1, c.skinS); }
    else { g.r(6, -6, 6, 3, c.hair); g.r(5, -4, 8, 3, c.skinS); g.r(5, -3, 8, 1, c.hair); }
    if (a.barberCutting) {
      for (let i = 0; i < 4; i++) {
        const k = (a.t * 1.6 + i * 0.27) % 1;
        g.p(3 + ((i * 5) % 13), -2 + Math.round(k * 14), c.hair);
      }
    }
  },
  waiting(g, a) {
    const p = person("waiting", "down", 0, "act");
    g.c.drawImage(p, 0, 0, 18, 16, g.ox + 12, g.oy - 6, 18, 16);
    g.r(16, 10, 2, 4, LOOKS.waiting.legs); g.r(23, 10, 2, 4, LOOKS.waiting.legs);
    g.r(15, 14, 3, 1, LOOKS.waiting.shoe); g.r(23, 14, 3, 1, LOOKS.waiting.shoe);
    const flip = a.t % 5 < 0.4;
    g.r(15, 3, flip ? 5 : 10, 6, C.white); g.r(20, 3, 1, 6, C.whiteS);
    g.r(16, 4, 3, 1, C.red); g.r(16, 6, 3, 1, "#9a9384"); if (!flip) { g.r(21, 5, 3, 1, "#9a9384"); g.r(21, 7, 3, 1, "#9a9384"); }
  },
  pcdesk(g, a) {
    // a simplified Apostro: sidebar, header, matters
    g.r(9, -7, 5, 11, "#241615");
    for (let i = 0; i < 4; i++) g.r(10, -5 + i * 2, 3, 1, i === Math.floor(a.t / 2) % 4 ? C.red : "#6a4a46");
    g.r(14, -7, 15, 2, C.red); g.r(15, -7, 3, 1, C.white);
    for (let i = 0; i < 3; i++) {
      g.r(15, -4 + i * 3, 8, 1, "#e8dcd0");
      g.r(25, -4 + i * 3, 3, 1, [C.green, C.amber, C.red][(i + Math.floor(a.t / 3)) % 3]!);
    }
    if (a.t % 1 < 0.5) g.p(15 + (Math.floor(a.t * 4) % 8), 4, C.white);
  },
};
