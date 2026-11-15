import { describe, expect, test } from "vitest";
import { BIKE_START, BUILDINGS, KINDS, MAP_H, MAP_W, PANELS, PROPS, SPAWN, T, STORY_PROJECTS } from "./world-content";
import { RIDE, WALK, areaAt, barberAt, blockedStatic, createWorld, feet, follow, haircut, interact, reachRect, step, target } from "./world-engine";
import { PROJECTS } from "../os/os-content";
import type { Input, WorldState } from "./world-types";

const idle: Input = { x: 0, y: 0, run: false };
const run = (s: WorldState, input: Input, seconds: number) => {
  for (let i = 0; i < Math.round(seconds * 60); i++) step(s, input, 1 / 60);
};

describe("content", () => {
  test("every prop has a kind, and every interactive prop has a panel", () => {
    for (const p of PROPS) {
      expect(KINDS[p.kind], p.id).toBeTruthy();
      if (p.panel) expect(PANELS[p.panel], p.id).toBeTruthy();
    }
    expect(new Set(PROPS.map((p) => p.id)).size).toBe(PROPS.length);
  });

  test("the workspace introduces real projects only", () => {
    for (const id of STORY_PROJECTS) expect(PROJECTS.some((p) => p.id === id), id).toBe(true);
  });

  test("the start is clear and the four places exist", () => {
    expect(blockedStatic(feet(SPAWN.x, SPAWN.y))).toBe(false);
    expect(blockedStatic(feet(BIKE_START.x, BIKE_START.y))).toBe(false);
    expect(BUILDINGS.map((b) => b.id).sort()).toEqual(["barbershop", "london", "repair", "workspace"]);
    expect(areaAt(4 * T, 5 * T)).toBe("repair");
    expect(areaAt(40 * T, 5 * T)).toBe("workspace");
    expect(areaAt(6 * T, 24 * T)).toBe("barbershop");
    expect(areaAt(30 * T, 25 * T)).toBe("london");
  });

  // One continuous world: from the start, every interactive thing can be walked up to.
  test("every interactive object is reachable on foot", () => {
    const G = 2, W = MAP_W / G, H = MAP_H / G;
    const seen = new Uint8Array(W * H);
    const q = [[Math.round(SPAWN.x / G), Math.round(SPAWN.y / G)]];
    seen[q[0]![1]! * W + q[0]![0]!] = 1;
    while (q.length) {
      const [x, y] = q.pop()!;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x! + dx!, ny = y! + dy!;
        if (nx < 0 || ny < 0 || nx >= W || ny >= H || seen[ny * W + nx]) continue;
        if (blockedStatic(feet(nx * G, ny * G))) continue;
        seen[ny * W + nx] = 1;
        q.push([nx, ny]);
      }
    }
    for (const prop of PROPS.filter((p) => p.panel)) {
      const r = reachRect(prop);
      let ok = false;
      for (let y = 0; y < H && !ok; y++) for (let x = 0; x < W && !ok; x++) {
        if (!seen[y * W + x]) continue;
        const px = x * G, py = y * G - 2;
        const dx = Math.max(r.x - px, 0, px - (r.x + r.w)), dy = Math.max(r.y - py, 0, py - (r.y + r.h));
        ok = Math.hypot(dx, dy) <= 12;
      }
      expect(ok, prop.id).toBe(true);
    }
  });
});

describe("movement", () => {
  test("moves in four directions at a steady speed, diagonals normalised", () => {
    const s = createWorld();
    run(s, { x: 1, y: 0, run: false }, 0.5);
    expect(s.player.x - SPAWN.x).toBeCloseTo(WALK * 0.5, 0);
    expect(s.player.dir).toBe("right");

    const d = createWorld();
    run(d, { x: -1, y: 1, run: false }, 0.2);
    const moved = Math.hypot(d.player.x - SPAWN.x, d.player.y - SPAWN.y);
    expect(moved).toBeCloseTo(WALK * 0.2, 0);
  });

  test("walls and furniture stop the character", () => {
    const s = createWorld();
    s.player.x = 60; s.player.y = 120; // inside the repair shop, below the workbench
    run(s, { x: 0, y: -1, run: false }, 2);
    expect(s.player.y).toBeGreaterThanOrEqual(74 + 8 + 16);
    s.player.x = 200; s.player.y = 120;
    run(s, { x: 1, y: 0, run: false }, 2);
    expect(s.player.x).toBeLessThanOrEqual(14 * T - 5);
  });

  test("the camera stays inside the map", () => {
    const s = createWorld();
    s.player.x = 5; s.player.y = 5;
    follow(s, 400, 240, 0, true);
    expect(s.cam).toEqual({ x: 0, y: 0 });
    s.player.x = MAP_W; s.player.y = MAP_H;
    follow(s, 400, 240, 0, true);
    expect(s.cam).toEqual({ x: MAP_W - 400, y: MAP_H - 240 });
  });
});

describe("the bicycle", () => {
  test("mount, ride faster, dismount", () => {
    const s = createWorld();
    s.player.x = BIKE_START.x - 10; s.player.dir = "right";
    expect(target(s)).toEqual({ kind: "bike" });
    expect(interact(s).type).toBe("mount");
    expect(s.player.riding).toBe(true);
    run(s, idle, 0.4); // the mounting hop
    const x0 = s.player.x;
    run(s, { x: 1, y: 0, run: false }, 0.5);
    expect(s.player.x - x0).toBeGreaterThan(RIDE * 0.4);
    expect(s.bike.x).toBe(s.player.x);
    expect(interact(s).type).toBe("dismount");
    expect(s.player.riding).toBe(false);
    expect(blockedStatic(feet(s.player.x, s.player.y))).toBe(false);
  });
});

describe("bikes stay outside", () => {
  test("riding stops at a doorway; walking goes in", () => {
    const s = createWorld();
    s.player.x = 128; s.player.y = 204; s.player.riding = true; // below the repair shop's door
    run(s, { x: 0, y: -1, run: false }, 1);
    expect(s.player.y).toBeGreaterThanOrEqual(11 * T + 4);
    expect(s.note?.text).toMatch(/Bikes stay outside/);
    s.player.riding = false;
    run(s, { x: 0, y: -1, run: false }, 1);
    expect(s.player.y).toBeLessThan(10 * T);
  });
});

describe("interactions", () => {
  test("the workbench opens The beginning", () => {
    const s = createWorld();
    s.player.x = 50; s.player.y = 104; s.player.dir = "up";
    const a = interact(s);
    expect(a.type === "panel" && a.panel).toBe("beginning");
    expect(s.used.workbench).toBeDefined();
  });

  test("nothing in reach does nothing", () => {
    const s = createWorld();
    s.player.x = 120; s.player.y = 216; // on the path, far from everything
    expect(interact(s).type).toBe("none");
  });
});

describe("the barbershop", () => {
  test("the barber circles the chair and the haircut progresses", () => {
    const xs = new Set<number>();
    for (let t = 0; t < 9; t += 0.25) xs.add(Math.round(barberAt(t).x));
    expect(xs.size).toBeGreaterThan(3);
    expect(haircut(0.5).length).toBe(2);
    expect(haircut(8.5).length).toBe(0);
    expect(haircut(9.5).customer).toBe(1);
  });
});
