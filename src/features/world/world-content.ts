// HONEYBADGER's layout and words. One continuous map: the repair shop and the
// engineering workspace up top, the barbershop and London below, joined by a
// path with the bicycle parked in the middle.
//
// Panel text is either Ayush's own words or read straight from AYUSH.OS's
// content, so the world never says anything the portfolio doesn't.
import { IDENTITY, LOG, PHASES, PRODUCTS, PROJECTS, ROLES, TECH } from "../os/os-content";
import type { AreaId, Building, Ground, Kind, KindSpec, Panel, PanelId, Prop, Rect } from "./world-types";

export const T = 16;
export const COLS = 50;
export const ROWS = 32;
export const MAP_W = COLS * T;
export const MAP_H = ROWS * T;

export const SPAWN = { x: 380, y: 216 };
export const BIKE_START = { x: 412, y: 216 };

const r = (x: number, y: number, w: number, h: number): Rect => ({ x, y, w, h });

export const KINDS: Record<Kind, KindSpec> = {
  tree: { w: 32, h: 40, solid: r(10, 32, 12, 6) },
  pine: { w: 22, h: 38, solid: r(7, 31, 8, 6) },
  bush: { w: 16, h: 13, solid: r(2, 6, 12, 6) },
  flowers: { w: 16, h: 10, decal: true },
  rock: { w: 12, h: 9, solid: r(1, 3, 10, 5) },
  lamp: { w: 8, h: 34, solid: r(2, 30, 4, 4), light: { x: 4, y: 5, r: 54, warm: true } },
  signpost: { w: 18, h: 26, solid: r(7, 21, 4, 4) },
  pole: { w: 4, h: 34, solid: r(0, 30, 4, 4) },
  flags: { w: 178, h: 30, overhead: true },
  himalaya: { w: 160, h: 48, solid: r(2, 24, 156, 24) },
  stupa: { w: 30, h: 38, solid: r(1, 26, 28, 12), light: { x: 15, y: 18, r: 30, warm: true } },
  momoStall: { w: 40, h: 34, solid: r(2, 20, 36, 14), light: { x: 20, y: 14, r: 40, warm: true } },
  bench: { w: 28, h: 14, solid: r(0, 4, 28, 9) },
  barberPole: { w: 8, h: 24, solid: r(1, 20, 6, 4), light: { x: 4, y: 8, r: 26 } },
  aboard: { w: 14, h: 16, solid: r(1, 11, 12, 4) },
  cafe: { w: 112, h: 96, solid: r(0, 0, 112, 96), light: { x: 56, y: 76, r: 70, warm: true } },
  cafeTable: { w: 26, h: 16, solid: r(4, 8, 18, 7) },
  tower: { w: 22, h: 70, solid: r(3, 58, 16, 12), light: { x: 11, y: 22, r: 22, warm: true } },
  phonebox: { w: 14, h: 28, solid: r(0, 20, 14, 8), light: { x: 7, y: 12, r: 20, warm: true } },
  bus: { w: 72, h: 34, solid: r(0, 12, 72, 22) },
  cab: { w: 34, h: 22, solid: r(0, 7, 34, 15) },
  bikerack: { w: 28, h: 16, solid: r(0, 10, 28, 6) },
  roundel: { w: 12, h: 28, solid: r(4, 24, 4, 4) },
  bin: { w: 8, h: 12, solid: r(0, 6, 8, 6) },
  ducks: { w: 60, h: 30, decal: false },

  pegboard: { w: 44, h: 20, wall: true },
  pane: { w: 22, h: 18, wall: true, light: { x: 11, y: 20, r: 34 } },
  shelf: { w: 30, h: 34, solid: r(0, 22, 30, 12) },
  workbench: { w: 44, h: 24, solid: r(0, 8, 44, 16), light: { x: 34, y: 6, r: 44, warm: true } },
  stool: { w: 8, h: 9, solid: r(1, 5, 6, 4) },
  solder: { w: 22, h: 20, solid: r(0, 8, 22, 12) },
  cabinet: { w: 18, h: 26, solid: r(0, 14, 18, 12) },
  crate: { w: 16, h: 14, solid: r(0, 4, 16, 10) },
  boxes: { w: 18, h: 20, solid: r(0, 10, 18, 10) },
  rugRed: { w: 56, h: 32, decal: true },

  whiteboard: { w: 44, h: 22, wall: true },
  poster: { w: 24, h: 20, wall: true },
  rack: { w: 22, h: 44, solid: r(0, 30, 22, 14), light: { x: 11, y: 20, r: 26 } },
  devdesk: { w: 52, h: 26, solid: r(0, 10, 52, 16), light: { x: 26, y: 6, r: 46 } },
  chair: { w: 12, h: 16, solid: r(1, 10, 10, 6) },
  laptopdesk: { w: 38, h: 22, solid: r(0, 8, 38, 14), light: { x: 19, y: 6, r: 30 } },
  plant: { w: 12, h: 20, solid: r(2, 14, 8, 6) },
  sofa: { w: 36, h: 20, solid: r(0, 6, 36, 14) },
  rugBlue: { w: 60, h: 34, decal: true },

  mirror: { w: 26, h: 22, wall: true },
  counter: { w: 30, h: 10, solid: r(0, 2, 30, 8) },
  barberChair: { w: 18, h: 22, solid: r(1, 12, 16, 10), light: { x: 9, y: 4, r: 40, warm: true } },
  barberChairEmpty: { w: 18, h: 22, solid: r(1, 12, 16, 10) },
  reception: { w: 44, h: 24, solid: r(0, 8, 44, 16), light: { x: 30, y: 6, r: 34 } },
  waiting: { w: 40, h: 18, solid: r(0, 8, 40, 10) },
  productShelf: { w: 16, h: 30, solid: r(0, 20, 16, 10) },
  coffeeTable: { w: 18, h: 12, solid: r(0, 4, 18, 8) },
  pricelist: { w: 22, h: 18, wall: true },

  bookshelf: { w: 30, h: 34, solid: r(0, 22, 30, 12) },
  banner: { w: 52, h: 12, wall: true },
  apostroPoster: { w: 22, h: 20, wall: true },
  studydesk: { w: 40, h: 22, solid: r(0, 8, 40, 14), light: { x: 8, y: 4, r: 38, warm: true } },
  pcdesk: { w: 38, h: 24, solid: r(0, 8, 38, 16), light: { x: 19, y: 6, r: 44 } },
};

export const BUILDINGS: Building[] = [
  { id: "repair", x0: 1, y0: 1, x1: 14, y1: 10, floor: "wood", wall: "plaster", doors: [{ side: "s", a: 7, b: 8 }] },
  { id: "workspace", x0: 33, y0: 1, x1: 48, y1: 10, floor: "carpet", wall: "panel", doors: [{ side: "s", a: 40, b: 41 }] },
  { id: "barbershop", x0: 1, y0: 19, x1: 16, y1: 29, floor: "checker", wall: "tile", doors: [{ side: "n", a: 8, b: 9 }, { side: "e", a: 24, b: 25 }] },
  { id: "london", x0: 36, y0: 16, x1: 48, y1: 23, floor: "uni", wall: "brick", doors: [{ side: "s", a: 41, b: 42 }] },
];

/** Where each place starts and ends, for the name card shown on arrival. */
export const AREAS: { id: AreaId; name: string; n: string; rect: Rect }[] = [
  { id: "repair", name: "The repair shop", n: "01", rect: r(T, T, 14 * T, 10 * T) },
  { id: "workspace", name: "The engineering workspace", n: "02", rect: r(33 * T, T, 16 * T, 10 * T) },
  { id: "barbershop", name: "The barbershop", n: "03", rect: r(T, 19 * T, 16 * T, 11 * T) },
  { id: "london", name: "London", n: "04", rect: r(17 * T, 16 * T, 32 * T, 14 * T) },
];

const inside = (x: number, y: number, x0: number, y0: number, x1: number, y1: number) => x >= x0 && x <= x1 && y >= y0 && y <= y1;

/** The ground under a tile, before walls go on top. */
export function groundAt(x: number, y: number): Ground {
  for (const b of BUILDINGS) if (inside(x, y, b.x0, b.y0, b.x1, b.y1)) return b.floor;
  if (y >= 30) return "water";
  if (inside(x, y, 29, 19, 32, 20)) return "water";
  if (x === 0 || x === COLS - 1 || y === 0) return "hedge";
  if (inside(x, y, 17, 26, 48, 28)) return "road";
  if (inside(x, y, 17, 24, 48, 25) || inside(x, y, 17, 29, 48, 29) || inside(x, y, 18, 22, 24, 23)) return "pave";
  if (inside(x, y, 1, 12, 48, 14)) return "path";
  if (inside(x, y, 7, 11, 8, 11) || inside(x, y, 40, 11, 41, 11) || inside(x, y, 8, 15, 9, 18) || inside(x, y, 25, 15, 26, 23)) return "path";
  return "grass";
}

/** A wall tile, if this tile is one: which part of which building. */
export function wallAt(x: number, y: number): { b: Building; part: "north" | "south" | "side" } | null {
  for (const b of BUILDINGS) {
    if (!inside(x, y, b.x0, b.y0, b.x1, b.y1)) continue;
    const door = b.doors.some((d) =>
      (d.side === "s" && y === b.y1 && x >= d.a && x <= d.b) ||
      (d.side === "n" && y <= b.y0 + 1 && x >= d.a && x <= d.b) ||
      (d.side === "e" && x === b.x1 && y >= d.a && y <= d.b) ||
      (d.side === "w" && x === b.x0 && y >= d.a && y <= d.b));
    if (door) return null;
    if (y <= b.y0 + 1) return { b, part: "north" };
    if (y === b.y1) return { b, part: "south" };
    if (x === b.x0 || x === b.x1) return { b, part: "side" };
    return null;
  }
  return null;
}

export const tileSolid = (x: number, y: number) => {
  if (x < 0 || y < 0 || x >= COLS || y >= ROWS) return true;
  const g = groundAt(x, y);
  return g === "water" || g === "hedge" || !!wallAt(x, y);
};

const p = (id: string, kind: Kind, x: number, y: number, panel?: PanelId): Prop => ({ id, kind, x, y, ...(panel ? { panel } : {}) });

export const PROPS: Prop[] = [
  // 01 · The repair shop
  p("pegboard", "pegboard", 40, 22),
  p("r-window", "pane", 182, 22),
  p("shelf-1", "shelf", 106, 30),
  p("shelf-2", "shelf", 138, 30),
  p("cabinet", "cabinet", 200, 44),
  p("workbench", "workbench", 40, 74, "beginning"),
  p("stool", "stool", 58, 100),
  p("solder", "solder", 100, 80),
  p("crate", "crate", 40, 136),
  p("boxes", "boxes", 198, 132),
  p("rug-r", "rugRed", 120, 104),

  // 02 · The engineering workspace
  p("whiteboard", "whiteboard", 556, 20, "log"),
  p("poster", "poster", 610, 22),
  p("w-window", "pane", 690, 22),
  p("rack", "rack", 738, 26, "stack"),
  p("devdesk", "devdesk", 560, 66),
  p("chair-1", "chair", 580, 90),
  p("laptopdesk", "laptopdesk", 680, 80, "laptop"),
  p("chair-2", "chair", 693, 98),
  p("plant-w1", "plant", 548, 134),
  p("plant-w2", "plant", 750, 134),
  p("sofa", "sofa", 584, 132),
  p("rug-b", "rugBlue", 620, 108),

  // 03 · The barbershop
  p("mirror-1", "mirror", 40, 308),
  p("mirror-2", "mirror", 84, 308),
  p("pricelist", "pricelist", 176, 310),
  p("counter-1", "counter", 38, 336),
  p("counter-2", "counter", 82, 336),
  p("chair-b1", "barberChair", 44, 356, "barber"),
  p("chair-b2", "barberChairEmpty", 88, 356),
  p("reception", "reception", 186, 346, "clippr"),
  p("pshelf", "productShelf", 234, 312),
  p("waiting", "waiting", 184, 432),
  p("ctable", "coffeeTable", 156, 438),
  p("plant-b", "plant", 36, 438),
  p("barber-pole", "barberPole", 114, 278),
  p("aboard", "aboard", 166, 284),

  // Between the places: the path, the garden and the bunting
  p("signpost", "signpost", 344, 166, "signpost"),
  p("lamp-1", "lamp", 300, 158),
  p("lamp-2", "lamp", 520, 158),
  p("lamp-3", "lamp", 176, 210),
  p("himalaya", "himalaya", 300, 2),
  p("pole-1", "pole", 288, 54),
  p("pole-2", "pole", 466, 54),
  p("flags", "flags", 290, 54),
  p("stupa", "stupa", 374, 70),
  p("momo", "momoStall", 428, 138, "momo"),
  p("tree-1", "tree", 238, 14),
  p("tree-2", "tree", 494, 16),
  p("tree-3", "tree", 250, 112),
  p("tree-4", "tree", 480, 110),
  p("pine-1", "pine", 330, 72),
  p("pine-2", "pine", 424, 70),
  p("bench-g", "bench", 364, 128),
  p("bush-1", "bush", 290, 140),
  p("rock-1", "rock", 300, 120),
  p("flowers-1", "flowers", 310, 100),
  p("flowers-2", "flowers", 440, 92),
  p("flowers-3", "flowers", 404, 150),
  p("tree-5", "tree", 20, 238),
  p("bush-3", "bush", 60, 280),
  p("bush-4", "bush", 196, 262),
  p("tree-6", "tree", 220, 236),
  p("bench-b", "bench", 160, 246),
  p("tree-7", "tree", 560, 214),
  p("tree-8", "tree", 722, 214),
  p("bush-5", "bush", 620, 178),
  p("flowers-4", "flowers", 640, 244),

  // 04 · London
  p("cafe", "cafe", 288, 256),
  p("cafe-t1", "cafeTable", 294, 356),
  p("cafe-t2", "cafeTable", 352, 356),
  p("tree-l1", "tree", 434, 250),
  p("tree-l2", "tree", 438, 334),
  p("tower", "tower", 546, 250),
  p("ducks", "ducks", 466, 302),
  p("bench-p", "bench", 486, 352),
  p("flowers-l", "flowers", 520, 344),
  p("lamp-4", "lamp", 380, 352),
  p("lamp-5", "lamp", 566, 352),
  p("lamp-6", "lamp", 734, 352),
  p("phonebox", "phonebox", 530, 362),
  p("roundel", "roundel", 438, 362),
  p("bin", "bin", 604, 384),
  p("bikerack", "bikerack", 696, 386),
  p("bus", "bus", 566, 418),
  p("cab", "cab", 368, 430),
  p("bookshelf", "bookshelf", 598, 262),
  p("banner", "banner", 636, 262),
  p("apostro-poster", "apostroPoster", 698, 262),
  p("u-window", "pane", 736, 262),
  p("studydesk", "studydesk", 608, 316, "chapter"),
  p("chair-u1", "chair", 622, 334),
  p("pcdesk", "pcdesk", 700, 314, "apostro"),
  p("chair-u2", "chair", 713, 334),
  p("plant-u", "plant", 750, 340),
];

export const PIGEON_HOMES = [{ x: 330, y: 396 }, { x: 344, y: 402 }, { x: 318, y: 404 }];

// ---------- What the places say ----------

const list = (xs: string[]) => (xs.length < 2 ? xs.join("") : `${xs.slice(0, -1).join(", ")} and ${xs.at(-1)}`);
const product = (id: string) => PRODUCTS.find((x) => x.id === id);
const projectName = (id: string) => PROJECTS.find((x) => x.id === id)?.name ?? id;
const phase = (id: string) => PHASES.find((x) => x.id === id)?.summary ?? "";

export const STORY_PROJECTS = ["timepieces", "timecom", "broadway", "excitation", "squadery"] as const;

export const PANELS: Record<PanelId, Panel> = {
  momo: {
    kicker: "The momo stall",
    title: "Momo",
    body: [
      "Steamed, with achar on the side.",
      `${IDENTITY.origin}. ${list(ROLES.filter((x) => x.location === "Kathmandu").map((x) => x.short ?? x.org))} were in Kathmandu.`,
    ],
    actions: [{ label: "Career timeline", app: "career" }],
  },
  beginning: {
    kicker: "01 · The repair shop",
    title: "The beginning",
    body: ["Before building software, I developed an interest in understanding technology from the hardware level."],
    actions: [{ label: "Career timeline", app: "career" }],
  },
  laptop: {
    kicker: "02 · The engineering workspace",
    title: "Engineering journey",
    body: [phase("product"), phase("lead")],
    screen: "dev",
    actions: [
      ...STORY_PROJECTS.map((id) => ({ label: projectName(id), app: "projects" as const, id })),
      { label: "All projects", app: "projects" },
    ],
  },
  log: {
    kicker: "02 · The whiteboard",
    title: "ENGINEERING.LOG",
    body: [`${LOG.length} write-ups: the context, the constraints, the approach and what came of it.`],
    actions: [{ label: "Open the log", app: "log" }],
  },
  stack: {
    kicker: "02 · The server rack",
    title: "STACK.MAP",
    body: [`${TECH.length} technologies, each traced to the work it was used on.`],
    actions: [{ label: "Open the stack map", app: "stack" }],
  },
  barber: {
    kicker: "03 · The barbershop",
    title: "From building software to running a business",
    body: [
      "I have experience working as a barber and understanding the day-to-day operations of a barbershop.",
      "This real-world experience influenced the development of TheClippr.",
    ],
    actions: [{ label: "TheClippr", app: "founder", id: "theclippr" }],
  },
  clippr: {
    kicker: "03 · The booking desk",
    title: "TheClippr",
    body: [product("theclippr")?.description ?? ""],
    bullets: product("theclippr")?.features,
    screen: "clippr",
    actions: [{ label: "Explore TheClippr", app: "founder", id: "theclippr" }],
  },
  chapter: {
    kicker: "04 · London",
    title: "The next chapter",
    body: [],
    bullets: [
      "Relocated to London.",
      "MSc Artificial Intelligence.",
      "Independent product development.",
      "Applied AI and agentic systems.",
      "Building Apostro.",
    ],
    actions: [
      { label: "The London chapter", app: "career", id: "transition" },
      { label: "Apostro", app: "founder", id: "apostro" },
    ],
  },
  apostro: {
    kicker: "04 · The workstation",
    title: "Apostro",
    body: [product("apostro")?.tagline ?? "", product("apostro")?.description ?? ""],
    screen: "apostro",
    actions: [
      { label: "Apostro", app: "founder", id: "apostro" },
      { label: "TheClippr", app: "founder", id: "theclippr" },
      { label: "ALLS Legal", app: "founder", id: "allslegal" },
    ],
  },
  signpost: {
    kicker: "The crossroads",
    title: "HONEYBADGER",
    body: ["Four places on one path. The bicycle is the quick way between them."],
    screen: "map",
    actions: [],
  },
};

/** The features Apostro's screen lists, straight from FOUNDER.MODE. */
export const APOSTRO_FEATURES = product("apostro")?.features ?? [];
