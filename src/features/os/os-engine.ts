// AYUSH.OS behaviour as pure functions: the window manager, lookups, discovery
// rules, deep links and the terminal. No React, no DOM, no real clock: the
// current month is always passed in.
import { DISCOVERIES, IDENTITY, LOG, PRODUCTS, PROJECTS, ROLES, TECH, TECH_LINKS } from "./os-content";
import type { AppId, Month, OsAction, OsState, Role, Tech, TechLink, TermLine, TermResult } from "./os-types";

// ---------- Apps ----------

export const APPS: { id: Exclude<AppId, "terminal">; name: string; label: string; blurb: string; key: string }[] = [
  { id: "career", name: "CAREER.EXE", label: "Career", blurb: "Nine years, chapter by chapter", key: "1" },
  { id: "projects", name: "PROJECTS.DB", label: "Projects", blurb: "Case studies from client work", key: "2" },
  { id: "stack", name: "STACK.MAP", label: "Stack", blurb: "What was used where, and why", key: "3" },
  { id: "log", name: "ENGINEERING.LOG", label: "Log", blurb: "Constraints, decisions, outcomes", key: "4" },
  { id: "founder", name: "FOUNDER.MODE", label: "Founder", blurb: "Independent products", key: "5" },
];

export const appName = (app: AppId) => (app === "terminal" ? "TERMINAL" : APPS.find((a) => a.id === app)?.name ?? app);

// ---------- Dates ----------

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export const monthIndex = ({ y, m }: Month) => y * 12 + (m - 1);
/** Months from start to end, counting both ends. */
export const monthsBetween = (a: Month, b: Month) => monthIndex(b) - monthIndex(a) + 1;
export const formatMonth = ({ y, m }: Month) => `${MONTHS[m - 1]} ${y}`;
export const formatRange = (a: Month, b: Month) => `${formatMonth(a)} – ${formatMonth(b)}`;
export const formatDuration = (months: number) => {
  const y = Math.floor(months / 12), m = months % 12;
  const parts = [y ? `${y} yr${y > 1 ? "s" : ""}` : "", m ? `${m} mo` : ""].filter(Boolean);
  return parts.join(" ") || "< 1 mo";
};
export const isoMonth = ({ y, m }: Month) => `${y}-${String(m).padStart(2, "0")}`;

// ---------- Lookups ----------

export const roleById = (id: string) => ROLES.find((r) => r.id === id);
export const projectById = (id: string) => PROJECTS.find((p) => p.id === id);
export const logById = (id: string) => LOG.find((l) => l.id === id);
export const productById = (id: string) => PRODUCTS.find((p) => p.id === id);
export const techById = (id: string) => TECH.find((t) => t.id === id);

export const findTech = (query: string): Tech | undefined => {
  const q = query.trim().toLowerCase().replace(/\s+/g, "");
  return TECH.find((t) => t.id === q || t.name.toLowerCase().replace(/\s+/g, "") === q || t.name.toLowerCase().replace(/[.\s]/g, "") === q.replace(/\./g, ""));
};

export const linksForTech = (tech: string): TechLink[] => TECH_LINKS.filter((l) => l.tech === tech);
export const linksForTarget = (target: string): TechLink[] => TECH_LINKS.filter((l) => l.target === target);
export const techFor = (target: string): Tech[] => linksForTarget(target).map((l) => techById(l.tech)).filter((t): t is Tech => !!t);

/** Projects and roles that technologies point at, in the order the stack map lists them. */
export const STACK_TARGETS: { id: string; name: string; kind: "project" | "role" }[] = [
  ...PROJECTS.map((p) => ({ id: p.id, name: p.name, kind: "project" as const })),
  ...["hazesoft", "diprung"].map((id) => ({ id, name: `${roleById(id)?.org ?? id}`, kind: "role" as const })),
].filter((t) => linksForTarget(t.id).length > 0);

export const targetName = (id: string) => projectById(id)?.name ?? roleById(id)?.org ?? id;

/** The roles on the main path (no side quests), oldest first. */
export const mainRoles = () => ROLES.filter((r) => r.kind !== "side");
export const sideQuests = () => ROLES.filter((r) => r.kind === "side");

export const currentTitle = (r: Role) => r.titles[r.titles.length - 1]?.title ?? "";

// ---------- Discoveries ----------

/** Which discovery, if any, viewing this item unlocks. */
export const discoveryFor = (app: AppId, id: string | undefined): string | null => {
  if (!id) return null;
  const rules: Record<string, string> = {
    "projects:broadway": "deadline", "log:eng-003": "deadline",
    "career:fusemachines": "lead",
    "projects:timepieces": "testnet", "log:eng-001": "testnet",
    "projects:timecom": "converter", "log:eng-002": "converter",
    "projects:excitation": "infra", "log:eng-005": "infra", "career:excitation": "infra",
    "founder:apostro": "founder", "founder:allslegal": "founder",
  };
  return rules[`${app}:${id}`] ?? null;
};

// ---------- Window manager ----------

export const initialState: OsState = { windows: [], zTop: 1, selection: {}, found: [], toast: null };

const CASCADE = { x: 28, y: 22, step: 26 };

export function osReducer(state: OsState, action: OsAction): OsState {
  const win = (app: AppId) => state.windows.find((w) => w.app === app);
  const patch = (app: AppId, fn: (w: OsState["windows"][number]) => OsState["windows"][number]) =>
    state.windows.map((w) => (w.app === app ? fn(w) : w));

  switch (action.type) {
    case "open": {
      const z = state.zTop + 1;
      const selection = action.select !== undefined ? { ...state.selection, [action.app]: action.select } : state.selection;
      if (win(action.app)) return { ...state, zTop: z, selection, windows: patch(action.app, (w) => ({ ...w, z, minimized: false })) };
      const n = state.windows.filter((w) => !w.minimized).length % 6;
      const at = action.at ?? { x: CASCADE.x + n * CASCADE.step, y: CASCADE.y + n * CASCADE.step };
      return { ...state, zTop: z, selection, windows: [...state.windows, { app: action.app, ...at, z, minimized: false, maximized: false }] };
    }
    case "close":
      return { ...state, windows: state.windows.filter((w) => w.app !== action.app) };
    case "focus": {
      const w = win(action.app);
      if (!w || (w.z === state.zTop && !w.minimized)) return state;
      const z = state.zTop + 1;
      return { ...state, zTop: z, windows: patch(action.app, (x) => ({ ...x, z, minimized: false })) };
    }
    case "minimize":
      return { ...state, windows: patch(action.app, (w) => ({ ...w, minimized: true })) };
    case "toggleMax":
      return { ...state, windows: patch(action.app, (w) => ({ ...w, maximized: !w.maximized })) };
    case "move":
      return { ...state, windows: patch(action.app, (w) => ({ ...w, x: action.x, y: action.y })) };
    case "select": {
      const selection = { ...state.selection };
      if (action.id === undefined) delete selection[action.app]; else selection[action.app] = action.id;
      return { ...state, selection };
    }
    case "discover":
      if (state.found.includes(action.id) || !DISCOVERIES.some((d) => d.id === action.id)) return state;
      return { ...state, found: [...state.found, action.id], toast: action.id };
    case "restoreFound": {
      const valid = action.ids.filter((id) => DISCOVERIES.some((d) => d.id === id));
      return { ...state, found: [...new Set([...state.found, ...valid])] };
    }
    case "dismissToast":
      return { ...state, toast: null };
  }
}

// The topmost open app: the one keyboard shortcuts act on.
export const focusedWindow = (state: OsState) =>
  state.windows.filter((w) => !w.minimized).sort((a, b) => b.z - a.z)[0];

// ---------- Deep links ----------

const APP_IDS: AppId[] = ["career", "projects", "stack", "log", "founder", "terminal"];

export const parseHash = (hash: string): { app: AppId; select?: string } | null => {
  const [app, select] = hash.replace(/^#\/?/, "").split("/");
  if (!app || !APP_IDS.includes(app as AppId)) return null;
  return select ? { app: app as AppId, select: decodeURIComponent(select) } : { app: app as AppId };
};

export const toHash = (app: AppId | undefined, select?: string) =>
  !app ? "" : `#${app}${select ? `/${encodeURIComponent(select)}` : ""}`;

// ---------- Terminal ----------

const out = (text: string, kind: TermLine["kind"] = "out"): TermLine => ({ kind, text });
const pad = (s: string, n: number) => s + " ".repeat(Math.max(1, n - s.length));

const APP_ALIASES: Record<string, AppId> = {
  career: "career", "career.exe": "career",
  projects: "projects", "projects.db": "projects",
  stack: "stack", "stack.map": "stack",
  log: "log", "engineering.log": "log",
  founder: "founder", "founder.mode": "founder",
};

/** Resolves a name to where it lives: an app, or an item inside one. */
export const resolveTarget = (name: string): { app: AppId; select?: string } | null => {
  const n = name.toLowerCase();
  if (APP_ALIASES[n]) return { app: APP_ALIASES[n] };
  if (projectById(n)) return { app: "projects", select: n };
  if (roleById(n)) return { app: "career", select: n };
  if (logById(n)) return { app: "log", select: n };
  if (productById(n)) return { app: "founder", select: n };
  const t = findTech(n);
  if (t) return { app: "stack", select: t.id };
  return null;
};

export const COMMANDS = ["help", "whoami", "ls", "open", "cat", "stack", "history", "uptime", "contact", "clear", "exit", "sudo"] as const;

const DIRS: Record<string, () => string[]> = {
  projects: () => PROJECTS.map((p) => `${pad(p.id, 14)}${p.name}`),
  career: () => mainRoles().map((r) => `${pad(r.id, 14)}${r.org}`),
  "side-quests": () => sideQuests().map((r) => `${pad(r.id, 14)}${r.org} · ${currentTitle(r)}`),
  stack: () => TECH.map((t) => t.id),
  log: () => LOG.map((l) => `${pad(l.id, 10)}${l.title}`),
  products: () => PRODUCTS.map((p) => `${pad(p.id, 14)}${p.name}`),
};

const stackLines = (t: Tech): TermLine[] => {
  const links = linksForTech(t.id);
  if (!links.length) return [out(`${t.name}: toolkit. Not tied to a featured project yet.`, "dim")];
  return [out(`${t.name} · used in ${links.length} place${links.length > 1 ? "s" : ""}`, "accent"), ...links.map((l) => out(`  ${pad(targetName(l.target), 22)}${l.note}`))];
};

const contactLines = (): TermLine[] => [
  out(`email     ${IDENTITY.email}`),
  out(`github    ${IDENTITY.github}`),
  out(`linkedin  ${IDENTITY.linkedin}`),
];

export function runCommand(input: string, now: Month): TermResult {
  const raw = input.trim();
  const lines: TermLine[] = [];
  const effects: TermResult["effects"] = [];
  if (!raw) return { lines, effects };
  const [cmd = "", ...args] = raw.split(/\s+/);
  const arg = args.join(" ");

  switch (cmd.toLowerCase()) {
    case "help":
      lines.push(
        out("Commands", "accent"),
        out("  whoami          who this is"),
        out("  ls [dir]        projects · career · side-quests · stack · log · products"),
        out("  open <name>     open an app or item, e.g. open broadway"),
        out("  cat <id>        print a summary"),
        out("  stack <tech>    where a technology was used, e.g. stack go"),
        out("  history         the career, as shell history"),
        out("  uptime          time since the first role"),
        out("  contact         ways to get in touch"),
        out("  clear · exit"),
        out("Tab completes. ↑/↓ recall.", "dim"),
      );
      break;
    case "whoami":
      lines.push(out(IDENTITY.name, "accent"), out(IDENTITY.titles.join(" · ")), out(IDENTITY.intro, "dim"), out(`${IDENTITY.location} · ${IDENTITY.origin}`, "dim"));
      break;
    case "ls": {
      const dir = arg.replace(/\/$/, "");
      if (!dir) { lines.push(out(Object.keys(DIRS).map((d) => `${d}/`).join("   "))); break; }
      const list = DIRS[dir];
      if (!list) { lines.push(out(`ls: ${dir}: no such directory`, "err")); break; }
      lines.push(...list().map((l) => out(l)));
      if (dir === "side-quests") effects.push({ type: "discover", id: "sidequests" });
      break;
    }
    case "open": {
      const target = arg ? resolveTarget(arg) : null;
      if (!target) { lines.push(out(arg ? `open: ${arg}: not found. Try ls.` : "open: name an app or item, e.g. open projects", "err")); break; }
      lines.push(out(`→ ${appName(target.app)}${target.select ? ` / ${target.select}` : ""}`, "dim"));
      effects.push({ type: "open", ...target });
      break;
    }
    case "cat": {
      const id = arg.toLowerCase();
      const p = projectById(id), r = roleById(id), l = logById(id), pr = productById(id), t = findTech(id);
      if (p) lines.push(out(`${p.name} · ${p.client}`, "accent"), out(`role: ${p.role}`), out(p.summary, "dim"));
      else if (r) lines.push(out(r.org, "accent"), ...r.titles.map((x) => out(`${x.title} · ${formatRange(x.start, x.end)}`)), out(r.summary, "dim"));
      else if (l) lines.push(out(`${l.id.toUpperCase()} · ${l.status.toUpperCase()}`, "accent"), out(l.title), out(l.summary, "dim"));
      else if (pr) lines.push(out(`${pr.name} · ${pr.status}`, "accent"), out(pr.description), out(pr.tagline, "dim"));
      else if (t) lines.push(...stackLines(t));
      else lines.push(out(arg ? `cat: ${arg}: no such file` : "cat: name an id. Try ls projects.", "err"));
      break;
    }
    case "stack": {
      const t = arg ? findTech(arg) : undefined;
      if (!t) { lines.push(out(arg ? `stack: ${arg}: unknown technology. Try ls stack.` : "stack: name a technology, e.g. stack go", "err")); break; }
      lines.push(...stackLines(t));
      break;
    }
    case "history":
      mainRoles().forEach((r, i) => lines.push(out(`${String(i + 1).padStart(4)}  ${isoMonth(r.start)}  ${pad(r.org, 34)}${currentTitle(r)}`)));
      lines.push(out("Side quests hidden. Try ls side-quests.", "dim"));
      break;
    case "uptime": {
      const months = monthIndex(now) - monthIndex(IDENTITY.careerStart);
      lines.push(out(`up ${formatDuration(months)} since ${formatMonth(IDENTITY.careerStart)} · ${mainRoles().length} chapters · ${PROJECTS.length} projects`));
      break;
    }
    case "contact":
      lines.push(...contactLines());
      break;
    case "clear":
      effects.push({ type: "clear" });
      break;
    case "exit":
      effects.push({ type: "close" });
      break;
    case "sudo":
      if (/^hire\s+ayush$/i.test(arg)) {
        lines.push(out("[sudo] permission granted.", "accent"), out("Good call. Here's how to reach him:"), ...contactLines());
        effects.push({ type: "discover", id: "hire" });
      } else lines.push(out("visitor is not in the sudoers file. This incident will be reported.", "err"), out("(Hint: there's one sudo command that works.)", "dim"));
      break;
    case "rm":
      lines.push(out("rm: read-only file system. Nice try.", "err"));
      break;
    default:
      lines.push(out(`command not found: ${cmd}. Try help.`, "err"));
  }
  return { lines, effects };
}

/** Tab completion: completes the command, then an id for commands that take one. */
export function complete(input: string): string {
  const parts = input.split(/\s+/);
  if (parts.length <= 1) {
    const hits = COMMANDS.filter((c) => c.startsWith(parts[0] ?? ""));
    return hits.length === 1 ? `${hits[0]} ` : input;
  }
  const [cmd, ...rest] = parts;
  const word = (rest.join(" ") ?? "").toLowerCase();
  const pool: string[] =
    cmd === "ls" ? Object.keys(DIRS)
      : cmd === "stack" ? TECH.map((t) => t.id)
        : cmd === "open" ? [...Object.keys(APP_ALIASES).filter((k) => !k.includes(".")), ...PROJECTS.map((p) => p.id), ...PRODUCTS.map((p) => p.id), ...LOG.map((l) => l.id), ...ROLES.map((r) => r.id)]
          : cmd === "cat" ? [...PROJECTS.map((p) => p.id), ...ROLES.map((r) => r.id), ...LOG.map((l) => l.id), ...PRODUCTS.map((p) => p.id)]
            : [];
  const hits = pool.filter((p) => p.startsWith(word));
  if (hits.length !== 1) return input;
  return `${cmd} ${hits[0]}`;
}
