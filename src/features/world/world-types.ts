// HONEYBADGER: the shapes shared by the world's content, engine and renderer.
// Units are world pixels; one tile is 16 of them.
import type { AppId } from "../os/os-types";

export type Dir = "down" | "up" | "left" | "right";
export type Rect = { x: number; y: number; w: number; h: number };

export type Ground = "grass" | "path" | "wood" | "carpet" | "checker" | "uni" | "pave" | "road" | "water" | "hedge";
export type AreaId = "repair" | "workspace" | "barbershop" | "london";
export type PanelId = "beginning" | "momo" | "laptop" | "log" | "stack" | "barber" | "clippr" | "chapter" | "apostro" | "signpost";

export type Kind =
  // outdoors
  | "tree" | "pine" | "bush" | "flowers" | "rock" | "lamp" | "signpost" | "pole" | "flags" | "bench"
  | "barberPole" | "aboard" | "cafe" | "cafeTable" | "tower" | "phonebox" | "bus" | "cab" | "bikerack"
  | "roundel" | "bin" | "ducks"
  // Nepal, in the garden
  | "himalaya" | "stupa" | "momoStall"
  // repair shop
  | "pegboard" | "pane" | "shelf" | "workbench" | "stool" | "solder" | "cabinet" | "crate" | "boxes" | "rugRed"
  // workspace
  | "whiteboard" | "poster" | "rack" | "devdesk" | "chair" | "laptopdesk" | "plant" | "sofa" | "rugBlue"
  // barbershop
  | "mirror" | "counter" | "barberChair" | "barberChairEmpty" | "reception" | "waiting" | "productShelf"
  | "coffeeTable" | "pricelist"
  // university
  | "bookshelf" | "banner" | "apostroPoster" | "studydesk" | "pcdesk";

export type KindSpec = {
  w: number;
  h: number;
  /** Footprint that blocks movement, relative to the sprite's top-left. */
  solid?: Rect;
  /** Hung on a wall: never blocks, always behind characters. */
  wall?: boolean;
  /** Painted into the ground layer. */
  decal?: boolean;
  /** Drawn above everything (bunting overhead). */
  overhead?: boolean;
  light?: { x: number; y: number; r: number; warm?: boolean };
};

export type Prop = { id: string; kind: Kind; x: number; y: number; panel?: PanelId };

export type Door = { side: "n" | "s" | "e" | "w"; a: number; b: number };
export type Building = {
  id: AreaId;
  /** Inclusive tile bounds of the outer walls. The north wall is two tiles tall. */
  x0: number; y0: number; x1: number; y1: number;
  floor: Ground;
  wall: "plaster" | "brick" | "panel" | "tile";
  doors: Door[];
};

export type PanelAction = { label: string; app: AppId; id?: string };
export type Panel = {
  kicker: string;
  title: string;
  body: string[];
  bullets?: string[];
  screen?: "dev" | "apostro" | "clippr" | "map";
  actions: PanelAction[];
};

export type Input = { x: number; y: number; run: boolean };

export type Player = {
  x: number; y: number; dir: Dir;
  moving: boolean;
  /** Distance walked, which drives the walk cycle. */
  stride: number;
  riding: boolean;
  /** Seconds left of the mount or dismount hop. */
  hop: number;
  /** Seconds left of the reach-out pose after interacting. */
  act: number;
};

export type Pigeon = { hx: number; hy: number; x: number; y: number; z: number; flight: number; vx: number; vy: number };

export type WorldState = {
  t: number;
  player: Player;
  bike: { x: number; y: number; dir: Dir };
  cam: { x: number; y: number };
  /** World time each prop was last used, for its animation. */
  used: Record<string, number>;
  pigeons: Pigeon[];
  note?: { text: string; until: number };
  /** Reduced motion: the barber holds still. */
  still?: boolean;
};

export type Target = { kind: "prop"; prop: Prop } | { kind: "bike" };
export type Action =
  | { type: "panel"; panel: PanelId; prop: Prop }
  | { type: "mount" }
  | { type: "dismount" }
  | { type: "blocked"; text: string }
  | { type: "none" };

export type Actor = { x: number; y: number; dir: Dir; moving: boolean; stride: number; cutting: boolean };
