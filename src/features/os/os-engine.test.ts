import { describe, expect, test } from "vitest";
import { DISCOVERIES, LOG, PRODUCTS, PROJECTS, ROLES, TECH, TECH_LINKS } from "./os-content";
import {
  complete, discoveryFor, focusedWindow, formatDuration, initialState, linksForTech, monthsBetween,
  osReducer, parseHash, resolveTarget, runCommand, toHash,
} from "./os-engine";

const NOW = { y: 2026, m: 11 };

describe("content integrity", () => {
  const ids = (xs: { id: string }[]) => xs.map((x) => x.id);

  test("ids are unique within each collection", () => {
    for (const xs of [ROLES, PROJECTS, TECH, LOG, PRODUCTS, DISCOVERIES]) expect(new Set(ids(xs)).size).toBe(xs.length);
  });

  test("every tech link points at a real technology and a real project or role", () => {
    const targets = new Set([...ids(PROJECTS), ...ids(ROLES)]);
    for (const l of TECH_LINKS) {
      expect(ids(TECH), l.tech).toContain(l.tech);
      expect(targets.has(l.target), l.target).toBe(true);
    }
  });

  test("tech links aren't duplicated", () => {
    const keys = TECH_LINKS.map((l) => `${l.tech}>${l.target}`);
    expect(new Set(keys).size).toBe(keys.length);
  });

  test("cross references resolve", () => {
    for (const p of PROJECTS) {
      expect(ids(ROLES)).toContain(p.roleId);
      if (p.logId) expect(ids(LOG)).toContain(p.logId);
    }
    for (const r of ROLES) for (const p of r.projects ?? []) expect(ids(PROJECTS)).toContain(p);
    for (const l of LOG) if (l.projectId) expect(ids(PROJECTS)).toContain(l.projectId);
    for (const p of PRODUCTS) if (p.evolvedFrom) expect(ids(PRODUCTS)).toContain(p.evolvedFrom);
  });

  test("dates run forwards, and titles sit inside their role", () => {
    for (const r of ROLES) {
      expect(monthsBetween(r.start, r.end), r.id).toBeGreaterThan(0);
      for (const t of r.titles) expect(monthsBetween(r.start, t.start)).toBeGreaterThan(0);
    }
  });

  test("Fusemachines is about three and a half years", () => {
    const f = ROLES.find((r) => r.id === "fusemachines")!;
    expect(formatDuration(monthsBetween(f.start, f.end))).toBe("3 yrs 6 mo");
  });

  test("Excitation is one engagement, not two", () => {
    expect(ROLES.filter((r) => /excitation|coax/i.test(r.org))).toHaveLength(1);
  });
});

describe("window manager", () => {
  test("open adds a focused window; reopening refocuses instead of duplicating", () => {
    let s = osReducer(initialState, { type: "open", app: "career" });
    s = osReducer(s, { type: "open", app: "projects", select: "broadway" });
    expect(focusedWindow(s)?.app).toBe("projects");
    expect(s.selection.projects).toBe("broadway");
    s = osReducer(s, { type: "open", app: "career" });
    expect(s.windows).toHaveLength(2);
    expect(focusedWindow(s)?.app).toBe("career");
  });

  test("minimize hides from focus; focus restores", () => {
    let s = osReducer(initialState, { type: "open", app: "career" });
    s = osReducer(s, { type: "minimize", app: "career" });
    expect(focusedWindow(s)).toBeUndefined();
    s = osReducer(s, { type: "focus", app: "career" });
    expect(focusedWindow(s)?.app).toBe("career");
  });

  test("discoveries are recorded once and ignore unknown ids", () => {
    let s = osReducer(initialState, { type: "discover", id: "deadline" });
    s = osReducer(s, { type: "discover", id: "deadline" });
    s = osReducer(s, { type: "discover", id: "nope" });
    expect(s.found).toEqual(["deadline"]);
    expect(s.toast).toBe("deadline");
  });

  test("viewing Broadway unlocks the delivery discovery", () => {
    expect(discoveryFor("projects", "broadway")).toBe("deadline");
    expect(discoveryFor("projects", "hdl")).toBeNull();
  });
});

describe("deep links", () => {
  test("round trip", () => {
    expect(parseHash(toHash("projects", "broadway"))).toEqual({ app: "projects", select: "broadway" });
    expect(parseHash("#career")).toEqual({ app: "career" });
    expect(parseHash("#nothing")).toBeNull();
  });
});

describe("terminal", () => {
  test("open resolves apps and items", () => {
    expect(resolveTarget("PROJECTS.DB")).toEqual({ app: "projects" });
    expect(resolveTarget("broadway")).toEqual({ app: "projects", select: "broadway" });
    expect(resolveTarget("next.js")).toEqual({ app: "stack", select: "nextjs" });
    expect(runCommand("open apostro", NOW).effects).toEqual([{ type: "open", app: "founder", select: "apostro" }]);
  });

  test("stack only reports stated links", () => {
    const go = runCommand("stack go", NOW).lines.map((l) => l.text).join("\n");
    expect(go).toContain("Excitation");
    expect(linksForTech("kafka")).toEqual([]);
    expect(runCommand("stack kafka", NOW).lines[0]?.text).toMatch(/toolkit/);
  });

  test("uptime counts from June 2017", () => {
    expect(runCommand("uptime", NOW).lines[0]?.text).toMatch(/^up 9 yrs 5 mo/);
  });

  test("the sudo easter egg", () => {
    expect(runCommand("sudo hire ayush", NOW).effects).toContainEqual({ type: "discover", id: "hire" });
    expect(runCommand("sudo rm", NOW).lines[0]?.kind).toBe("err");
  });

  test("unknown commands fail politely", () => {
    expect(runCommand("make coffee", NOW).lines[0]?.text).toMatch(/not found/);
  });

  test("tab completion", () => {
    expect(complete("hi")).toBe("history ");
    expect(complete("open broad")).toBe("open broadway");
    expect(complete("stack rabb")).toBe("stack rabbitmq");
  });
});
