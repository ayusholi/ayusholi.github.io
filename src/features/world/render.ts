// Draws one frame of HONEYBADGER: the cached ground, then props and people
// sorted by where their feet are, then the night's lighting on top.
import { BASE, ANIM, type AnimCtx } from "./art/props";
import { paintGround, paintWaterShimmer } from "./art/ground";
import { bike, person, rider } from "./art/people";
import { C, Px, makeCanvas, silhouette, sprite } from "./art/px";
import { BUILDINGS, KINDS, MAP_H, MAP_W, PROPS, T } from "./world-content";
import { HOP, barberAt, haircut, near, solidOf, walkFrame } from "./world-engine";
import type { Kind, Target, WorldState } from "./world-types";

/** Parts of a sprite that rise above its box (monitors on desks, bottles on counters). */
export const RISE: Partial<Record<Kind, number>> = { momoStall: 8, counter: 4, laptopdesk: 3, reception: 6, pcdesk: 8, studydesk: 1 };

export type Sprites = {
  ground: HTMLCanvasElement;
  props: Map<Kind, HTMLCanvasElement>;
  glow: Map<Kind, HTMLCanvasElement>;
};

export function buildSprites(): Sprites {
  const ground = paintGround();
  const props = new Map<Kind, HTMLCanvasElement>();
  const glow = new Map<Kind, HTMLCanvasElement>();
  for (const [kind, spec] of Object.entries(KINDS) as [Kind, (typeof KINDS)[Kind]][]) {
    const paint = BASE[kind];
    if (!paint) continue;
    const rise = RISE[kind] ?? 0;
    const c = sprite(spec.w, spec.h + rise, (g) => paint(g.at(0, rise)), !spec.decal);
    props.set(kind, c);
    if (PROPS.some((p) => p.kind === kind && p.panel)) glow.set(kind, silhouette(c));
  }
  // Rugs and flowers belong to the floor.
  const gctx = ground.getContext("2d")!;
  for (const p of PROPS) if (KINDS[p.kind].decal) gctx.drawImage(props.get(p.kind)!, p.x - 1, p.y - 1);
  return { ground, props, glow };
}

export type Frame = {
  target: Target | null;
  /** The prop whose panel is open. */
  activeProp?: string;
  /** Ambient time: frozen when the visitor prefers reduced motion. */
  t: number;
};

let light: { c: HTMLCanvasElement; ctx: CanvasRenderingContext2D } | null = null;

export function render(ctx: CanvasRenderingContext2D, s: WorldState, sp: Sprites, W: number, H: number, zoom: number, f: Frame) {
  const vw = W / zoom, vh = H / zoom;
  const ox = Math.round(s.cam.x * zoom), oy = Math.round(s.cam.y * zoom);
  const cam = { x: ox / zoom, y: oy / zoom };

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = "#0b0908";
  ctx.fillRect(0, 0, W, H);
  ctx.setTransform(zoom, 0, 0, zoom, -ox, -oy);

  const sx = Math.max(0, Math.floor(cam.x)), sy = Math.max(0, Math.floor(cam.y));
  const sw = Math.min(MAP_W - sx, Math.ceil(vw) + 2), sh = Math.min(MAP_H - sy, Math.ceil(vh) + 2);
  ctx.drawImage(sp.ground, sx, sy, sw, sh, sx, sy, sw, sh);

  const g = new Px(ctx);
  paintWaterShimmer(g, f.t, cam.x, cam.y, cam.x + vw, cam.y + vh);

  const inView = (x: number, y: number, w: number, h: number) => x + w > cam.x - 8 && x < cam.x + vw + 8 && y + h > cam.y - 8 && y < cam.y + vh + 24;
  const p = s.player;
  const barber = barberAt(f.t);
  const cut = haircut(f.t);
  const targetId = f.target?.kind === "prop" ? f.target.prop.id : undefined;
  const pulse = 0.55 + Math.sin(s.t * 5) * 0.35;

  type D = { y: number; draw: () => void };
  const list: D[] = [];
  const overhead: (() => void)[] = [];

  // Shadows first, so nothing stands in another's shadow by accident.
  ctx.fillStyle = "rgba(8,5,10,0.32)";
  const shadow = (x: number, y: number, w: number) => { ctx.beginPath(); ctx.ellipse(x, y, w / 2, Math.max(2, w / 6), 0, 0, Math.PI * 2); ctx.fill(); };

  for (const prop of PROPS) {
    const k = KINDS[prop.kind];
    if (k.decal) continue;
    const rise = RISE[prop.kind] ?? 0;
    if (!inView(prop.x, prop.y - rise - 12, k.w, k.h + rise + 12)) continue;
    const solid = solidOf(prop);
    if (solid && !k.wall) shadow(solid.x + solid.w / 2, solid.y + solid.h - 1, solid.w + 4);
    const a: AnimCtx = {
      t: f.t,
      since: s.used[prop.id] !== undefined ? s.t - s.used[prop.id]! : Infinity,
      near: near(s, prop, 24),
      active: f.activeProp === prop.id,
      cut,
      barberCutting: barber.cutting,
    };
    const draw = () => {
      if (prop.id === targetId) {
        const gl = sp.glow.get(prop.kind);
        if (gl) { ctx.globalAlpha = pulse; ctx.drawImage(gl, prop.x - 2, prop.y - 2 - rise); ctx.globalAlpha = 1; }
      }
      const img = sp.props.get(prop.kind);
      if (img) ctx.drawImage(img, prop.x - 1, prop.y - 1 - rise);
      ANIM[prop.kind]?.(g.at(prop.x, prop.y), a);
      if (prop.panel && prop.id !== targetId && s.used[prop.id] === undefined) marker(g, prop.x + k.w / 2, prop.y - rise - 7, s.t);
    };
    if (k.overhead) overhead.push(draw);
    else list.push({ y: k.wall ? -1 : solid ? solid.y + solid.h : prop.y + k.h, draw });
  }

  // The barber
  if (inView(barber.x - 10, barber.y - 22, 20, 24)) {
    shadow(barber.x, barber.y, 10);
    list.push({ y: barber.y, draw: () => {
      const pose = barber.cutting ? "cut" : "walk";
      const jig = barber.cutting && Math.floor(f.t * 6) % 2 ? 1 : 0;
      blit(ctx, person("barber", barber.dir, walkFrame(barber.stride), pose), barber.x, barber.y - jig, barber.dir === "right");
    } });
  }

  // Pigeons
  for (const pg of s.pigeons) {
    if (!inView(pg.x - 4, pg.y - pg.z - 6, 8, pg.z + 8)) continue;
    if (pg.z > 0) shadow(pg.x, pg.y, 5);
    list.push({ y: pg.y + (pg.z > 0 ? 400 : 0), draw: () => pigeon(g, pg.x, pg.y - pg.z, pg.flight > 0, f.t, pg.hx) });
  }

  // The bicycle, parked
  if (!p.riding) {
    const b = s.bike;
    shadow(b.x, b.y, 18);
    list.push({ y: b.y, draw: () => {
      const side = b.dir === "left" || b.dir === "right";
      const img = bike(b.dir, 0);
      blit(ctx, img, b.x, b.y, b.dir === "right", side ? 13 : 8, side ? 16 : 17);
    } });
  }

  // The player
  shadow(p.x, p.y, p.riding ? 16 : 10);
  list.push({ y: p.y, draw: () => {
    const hopY = p.hop > 0 ? Math.round(Math.sin((1 - p.hop / HOP) * Math.PI) * 4) : 0;
    if (p.riding) {
      const side = p.dir === "left" || p.dir === "right";
      blit(ctx, rider(p.dir, Math.floor(p.stride / 3)), p.x, p.y - hopY, p.dir === "right", side ? 13 : 9, side ? 33 : 29);
    } else {
      const pose = p.act > 0 ? "act" : p.moving ? "walk" : "idle";
      const frame = p.moving ? walkFrame(p.stride) : Math.floor(s.t * 1.4) % 2;
      blit(ctx, person("player", p.dir, frame, pose), p.x, p.y - hopY, p.dir === "right");
    }
  } });

  list.sort((a, b) => a.y - b.y);
  for (const d of list) d.draw();
  for (const d of overhead) d();

  lighting(ctx, s, cam, vw, vh, W, H, f.t);
}

/** Draws a frame with its feet at (x, y), mirrored for right-facing. */
function blit(ctx: CanvasRenderingContext2D, img: HTMLCanvasElement, x: number, y: number, flip: boolean, ax = 9, ay = 21) {
  const rx = Math.round(x), ry = Math.round(y);
  if (!flip) { ctx.drawImage(img, rx - ax, ry - ay); return; }
  ctx.save();
  ctx.translate(rx, 0);
  ctx.scale(-1, 1);
  ctx.drawImage(img, -(img.width - ax), ry - ay);
  ctx.restore();
}

/** A small bobbing diamond over things not yet looked at. */
function marker(g: Px, x: number, y: number, t: number, strong = false) {
  const b = Math.round(Math.sin(t * 4) * 1.5);
  const cx = Math.round(x), cy = Math.round(y + b);
  g.r(cx - 1, cy - 2, 3, 5, C.ink); g.r(cx - 2, cy - 1, 5, 3, C.ink);
  g.p(cx, cy - 1, strong ? C.white : C.red); g.r(cx - 1, cy, 3, 1, strong ? C.white : C.red); g.p(cx, cy + 1, strong ? C.white : C.red);
}

function pigeon(g: Px, x: number, y: number, flying: boolean, t: number, seed: number) {
  const X = Math.round(x), Y = Math.round(y);
  const flip = seed % 2 === 0;
  g.r(X - 3, Y - 4, 6, 3, "#8a8d96"); g.r(X - 2, Y - 2, 4, 1, "#6d7079");
  const hx = flip ? X - 4 : X + 2;
  const peck = !flying && Math.sin(t * 3 + seed) > 0.7 ? 1 : 0;
  g.r(hx, Y - 5 + peck, 2, 2, "#5a5d66"); g.p(flip ? hx - 1 : hx + 2, Y - 4 + peck, C.amber);
  if (flying) {
    const up = Math.floor(t * 14) % 2;
    g.r(X - 4, Y - 5 - up * 2, 3, 1, "#a3a6ae"); g.r(X + 1, Y - 5 - up * 2, 3, 1, "#a3a6ae");
  } else {
    g.p(X - 1, Y - 1, C.amber); g.p(X + 1, Y - 1, C.amber);
  }
}

function lighting(ctx: CanvasRenderingContext2D, s: WorldState, cam: { x: number; y: number }, vw: number, vh: number, W: number, H: number, t: number) {
  const lw = Math.ceil(vw), lh = Math.ceil(vh);
  if (!light || light.c.width !== lw || light.c.height !== lh) light = makeCanvas(lw, lh);
  const l = light.ctx;
  l.setTransform(1, 0, 0, 1, 0, 0);
  l.globalCompositeOperation = "source-over";
  l.clearRect(0, 0, lw, lh);
  l.fillStyle = "rgba(10,8,26,0.52)";
  l.fillRect(0, 0, lw, lh);
  l.globalCompositeOperation = "destination-out";
  l.setTransform(1, 0, 0, 1, -cam.x, -cam.y);

  // Rooms are lit from inside.
  l.fillStyle = "rgba(0,0,0,0.55)";
  for (const b of BUILDINGS) l.fillRect((b.x0 + 1) * T, (b.y0 + 1) * T, (b.x1 - b.x0 - 1) * T, (b.y1 - b.y0 - 1) * T);

  const warm: { x: number; y: number; r: number }[] = [];
  const hole = (x: number, y: number, r: number, k = 1) => {
    const gr = l.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, `rgba(0,0,0,${0.9 * k})`);
    gr.addColorStop(1, "rgba(0,0,0,0)");
    l.fillStyle = gr;
    l.fillRect(x - r, y - r, r * 2, r * 2);
  };
  for (const prop of PROPS) {
    const li = KINDS[prop.kind].light;
    if (!li) continue;
    const x = prop.x + li.x, y = prop.y + li.y;
    if (x + li.r < cam.x || x - li.r > cam.x + vw || y + li.r < cam.y || y - li.r > cam.y + vh) continue;
    const flick = li.warm ? 1 + Math.sin(t * 7 + prop.x) * 0.03 : 1;
    hole(x, y, li.r * flick);
    if (li.warm) warm.push({ x, y, r: li.r });
  }
  hole(s.player.x, s.player.y - 8, 34, 0.6);

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(light.c, 0, 0, lw, lh, 0, 0, (lw * W) / vw, (lh * H) / vh);
  ctx.imageSmoothingEnabled = false;

  // A warm bloom round lamps and windows.
  ctx.globalCompositeOperation = "lighter";
  const z = W / vw;
  for (const w of warm) {
    const x = (w.x - cam.x) * z, y = (w.y - cam.y) * z, r = w.r * 0.8 * z;
    const gr = ctx.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, "rgba(255,180,90,0.16)");
    gr.addColorStop(1, "rgba(255,180,90,0)");
    ctx.fillStyle = gr;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
  ctx.globalCompositeOperation = "source-over";
}
