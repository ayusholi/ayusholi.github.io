// The shapes behind AYUSH.OS. Content lives in os-content.ts; behaviour in os-engine.ts.

export type AppId = "career" | "projects" | "stack" | "log" | "founder" | "terminal";

/** A calendar month, 1-based: { y: 2017, m: 6 } is June 2017. */
export type Month = { y: number; m: number };

export type RoleKind = "main" | "parallel" | "transition" | "side";

export type Role = {
  id: string;
  org: string;
  /** A shorter name for tight spaces like timeline bars. */
  short?: string;
  /** One or more titles held, latest last. */
  titles: { title: string; start: Month; end: Month }[];
  start: Month;
  end: Month;
  kind: RoleKind;
  location?: string;
  summary: string;
  points: string[];
  projects?: string[];
  /** A short note shown for roles held alongside another. */
  note?: string;
};

export type Phase = { id: string; label: string; summary: string; start: Month; end: Month };

export type ProjectKind = "case-study" | "entry";

export type Project = {
  id: string;
  name: string;
  client: string;
  /** The role this work happened under, a Role id. */
  roleId: string;
  role: string;
  kind: ProjectKind;
  summary: string;
  contributions: string[];
  challenge?: string;
  solution?: string;
  outcome?: string[];
  notes?: string[];
  logId?: string;
  links?: { label: string; href: string }[];
};

export type TechGroup = "Languages" | "Frontend" | "Backend" | "Infrastructure" | "Data & messaging" | "Platforms & services" | "AI";

export type Tech = {
  id: string;
  name: string;
  group: TechGroup;
  /** A How Things Work explainer slug, where one exists. */
  explainer?: string;
};

/** One fact: this technology was used on this project or in this role. */
export type TechLink = { tech: string; target: string; note: string };

export type LogEntry = {
  id: string;
  title: string;
  system: string;
  type: "constraint" | "migration" | "delivery" | "architecture" | "infrastructure";
  status: "resolved" | "documented";
  summary: string;
  context: string[];
  constraints?: string[];
  approach: string[];
  outcome?: string[];
  projectId?: string;
  diagram?: "excitation";
};

export type Product = {
  id: string;
  name: string;
  tagline: string;
  status: string;
  description: string;
  features: string[];
  architecture?: string[];
  url?: string;
  /** A product this one grew out of. */
  evolvedFrom?: string;
  flagship?: boolean;
};

export type Discovery = { id: string; title: string; detail: string; hint: string; egg?: boolean };

/** One open app on the desktop. Position is in px from the desktop's top-left. */
export type Win = { app: AppId; x: number; y: number; z: number; minimized: boolean; maximized: boolean };

export type OsState = {
  windows: Win[];
  zTop: number;
  /** The item open inside each app, e.g. a project id. */
  selection: Partial<Record<AppId, string>>;
  found: string[];
  /** The newest discovery, shown as a toast until dismissed. */
  toast: string | null;
};

export type OsAction =
  | { type: "open"; app: AppId; select?: string; at?: { x: number; y: number } }
  | { type: "close"; app: AppId }
  | { type: "focus"; app: AppId }
  | { type: "minimize"; app: AppId }
  | { type: "toggleMax"; app: AppId }
  | { type: "move"; app: AppId; x: number; y: number }
  | { type: "select"; app: AppId; id: string | undefined }
  | { type: "discover"; id: string }
  | { type: "restoreFound"; ids: string[] }
  | { type: "dismissToast" };

export type TermLine = { kind: "in" | "out" | "dim" | "accent" | "err"; text: string };

export type TermEffect =
  | { type: "open"; app: AppId; select?: string }
  | { type: "close" }
  | { type: "clear" }
  | { type: "discover"; id: string };

export type TermResult = { lines: TermLine[]; effects: TermEffect[] };
