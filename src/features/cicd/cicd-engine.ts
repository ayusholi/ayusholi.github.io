// =========================================================
// A delivery pipeline, as a pure state model. No DOM, no timers.
//
// Models a commit becoming one immutable artifact that is promoted,
// unchanged, through staging to production; tests as a gate that
// stops the line; a manual approval; two deployment strategies; and
// rollback as redeploying an artifact that already exists.
// See cicd-engine.test.ts.
//
// Simplified on purpose: one branch, one pipeline at a time, a
// "hidden bug" that no test can catch and every real user would,
// and error counts per 100 requests rather than real traffic.
// =========================================================

import type { Packet } from "@/lib/simulation/simulation-types";
import type { CicdConfig, CicdEventType, CicdFrame, CicdNodeId, CicdState, Change, Release, Run, StageId } from "./cicd-types";

export const STAGES: StageId[] = ["build", "test", "publish", "staging", "approve", "prod"];
export const CANARY_SHARE = 10;   // percent of requests the canary takes

const MESSAGES: Record<Change, string[]> = {
  good: ["Add search filter", "Speed up checkout", "Fix typo in footer", "Tidy order emails"],
  "breaks-test": ["Refactor price rounding", "Rename cart fields"],
  "hidden-bug": ["Cache user sessions", "Batch invoice writes"],
};

// Stable fake hashes, so the same history always gets the same ids.
const hex = (n: number, salt: number) => ((Math.imul(n + salt, 2654435761) >>> 0).toString(16) + "0000000").slice(0, 7);

export const createState = (patch: CicdConfig = {}): CicdState => ({
  commits: [],
  runs: [],
  artifacts: [],
  staging: null,
  prod: null,
  history: [],
  strategy: "all",
  gate: "auto",
  waiting: null,
  next: 1,
  stats: { runs: 0, failedRuns: 0, deploys: 0, rollbacks: 0, badResponses: 0 },
  ...patch,
});

const packet = (from: CicdNodeId, to: CicdNodeId, label: string, kind: Packet["kind"] = "request"): Packet<CicdNodeId> => ({ from, to, label, kind });

const chain = (state: CicdState) => {
  let s = state;
  const frames: CicdFrame[] = [];
  const step = (type: CicdEventType, at: CicdNodeId, packets: Packet<CicdNodeId>[], patch: (st: CicdState) => CicdState = (st) => st, meta: Partial<CicdFrame> = {}) => {
    s = patch(s);
    frames.push({ type, state: s, packets, at, dur: 750, ...meta });
  };
  return { step, get state() { return s; }, frames };
};

const setStage = (s: CicdState, id: number, stage: StageId, status: Run["stages"][StageId]): CicdState => ({
  ...s, runs: s.runs.map((r) => (r.id === id ? { ...r, stages: { ...r.stages, [stage]: status } } : r)),
});
const skipRest = (s: CicdState, id: number): CicdState => ({
  ...s, runs: s.runs.map((r) => (r.id === id ? { ...r, stages: Object.fromEntries(STAGES.map((st) => [st, r.stages[st] === "pending" ? "skipped" : r.stages[st]])) as Run["stages"] } : r)),
});
const count = (s: CicdState, key: keyof CicdState["stats"], by = 1): CicdState => ({ ...s, stats: { ...s.stats, [key]: s.stats[key] + by } });

// Percent of production requests failing right now.
export const errorRate = (s: CicdState) => {
  const last = s.history[s.history.length - 1];
  if (last?.action === "canary" && last.release.bug) return CANARY_SHARE;
  return s.prod?.bug ? 100 : 0;
};

export const runOf = (s: CicdState, id: number | null) => s.runs.find((r) => r.id === id);
export const releaseOf = (s: CicdState, run: Run | undefined) => s.artifacts.find((a) => a.digest === run?.digest);

// ---------- A commit, from push to the gate ----------
export const commit = (state: CicdState, change: Change): CicdFrame[] => {
  const n = state.next;
  const sha = hex(n, 7);
  const list = MESSAGES[change];
  const c = chain(state);

  if (state.waiting !== null) {
    const old = state.waiting;
    c.step("run.superseded", "ci", [], (s) => ({ ...skipRest(setStage(s, old, "approve", "skipped"), old), waiting: null }), { run: old, dur: 450 });
  }

  c.step("push", "repo", [packet("dev", "repo", "git push")], (s) => ({ ...s, next: s.next + 1, commits: [...s.commits, { sha, message: list[n % list.length] as string, change }].slice(-8) }));
  const run: Run = { id: n, sha, digest: null, stages: Object.fromEntries(STAGES.map((st) => [st, "pending"])) as Run["stages"] };
  c.step("ci.triggered", "ci", [packet("repo", "ci", "webhook")], (s) => count({ ...s, runs: [...s.runs, run].slice(-6) }, "runs"), { run: n });
  c.step("build.passed", "ci", [], (s) => setStage(s, n, "build", "passed"), { run: n, stage: "build" });

  if (change === "breaks-test") {
    c.step("test.failed", "repo", [packet("ci", "repo", "✕ failing", "error")], (s) => count(skipRest(setStage(s, n, "test", "failed"), n), "failedRuns"), { run: n, stage: "test" });
    return c.frames;
  }
  c.step("test.passed", "ci", [packet("ci", "repo", "✓ passing", "value")], (s) => setStage(s, n, "test", "passed"), { run: n, stage: "test" });

  const release: Release = { sha, digest: `sha256:${hex(n, 91)}`, bug: change === "hidden-bug" };
  c.step("artifact.published", "registry", [packet("ci", "registry", release.digest.slice(7, 14), "value")],
    (s) => setStage({ ...s, artifacts: [...s.artifacts, release], runs: s.runs.map((r) => (r.id === n ? { ...r, digest: release.digest } : r)) }, n, "publish", "passed"), { run: n, stage: "publish" });
  c.step("staging.deployed", "staging", [packet("registry", "staging", release.digest.slice(7, 14), "value")], (s) => ({ ...s, staging: release }), { run: n, stage: "staging" });
  // Smoke tests check that it starts and answers. The hidden bug passes them.
  c.step("staging.checked", "staging", [packet("staging", "ci", "smoke ✓", "value")], (s) => setStage(s, n, "staging", "passed"), { run: n, stage: "staging" });

  if (c.state.gate === "manual") {
    c.step("gate.waiting", "ci", [], (s) => ({ ...setStage(s, n, "approve", "waiting"), waiting: n }), { run: n, stage: "approve" });
    return c.frames;
  }
  c.step("gate.approved", "ci", [], (s) => setStage(s, n, "approve", "passed"), { run: n, stage: "approve", dur: 450 });
  return [...c.frames, ...toProd(c.state, n)];
};

// ---------- Production ----------
const toProd = (state: CicdState, id: number): CicdFrame[] => {
  const release = releaseOf(state, runOf(state, id)) as Release;
  const tag = release.digest.slice(7, 14);
  const c = chain(state);

  if (state.strategy === "all") {
    c.step("prod.deployed", "prod", [packet("registry", "prod", tag, "value")],
      (s) => count({ ...setStage(s, id, "prod", "passed"), prod: release, history: [...s.history, { action: "deploy" as const, release }] }, "deploys"), { run: id, stage: "prod" });
    if (release.bug) c.step("prod.errors", "prod", [], (s) => count(s, "badResponses", 100), { run: id, stage: "prod", dur: 1000 });
    else c.step("prod.healthy", "prod", [], (s) => s, { run: id, stage: "prod" });
    return c.frames;
  }

  // Canary: a slice of traffic first, then a decision from what it measured.
  c.step("canary.deployed", "prod", [packet("registry", "prod", `${tag} · ${CANARY_SHARE}%`, "value")],
    (s) => ({ ...s, history: [...s.history, { action: "canary" as const, release }] }), { run: id, stage: "prod" });
  if (release.bug) {
    c.step("canary.failed", "prod", [], (s) => count(s, "badResponses", CANARY_SHARE), { run: id, stage: "prod", dur: 1000 });
    c.step("rollback.done", "prod", [packet("registry", "prod", "back to old", "error")],
      (s) => count({ ...setStage(s, id, "prod", "failed"), history: [...s.history, { action: "abort" as const, release }] }, "rollbacks"), { run: id, stage: "prod" });
    return c.frames;
  }
  c.step("canary.healthy", "prod", [], (s) => s, { run: id, stage: "prod" });
  c.step("canary.promoted", "prod", [packet("registry", "prod", `${tag} · 100%`, "value")],
    (s) => count({ ...setStage(s, id, "prod", "passed"), prod: release, history: [...s.history, { action: "deploy" as const, release }] }, "deploys"), { run: id, stage: "prod" });
  return c.frames;
};

export const approve = (state: CicdState): CicdFrame[] | null => {
  const id = state.waiting;
  if (id === null) return null;
  const s = { ...setStage(state, id, "approve", "passed"), waiting: null };
  return [{ type: "gate.approved", state: s, packets: [packet("dev", "repo", "approve")], at: "ci", run: id, stage: "approve", dur: 500 }, ...toProd(s, id)];
};

// The release before the current one. Rolling back rebuilds nothing.
export const previousRelease = (s: CicdState) => {
  const deployed = s.history.filter((h) => h.action === "deploy" || h.action === "rollback").map((h) => h.release);
  return [...deployed].reverse().find((r) => r.digest !== s.prod?.digest) ?? null;
};

export const rollback = (state: CicdState): CicdFrame[] | null => {
  const target = previousRelease(state);
  if (!target) return null;
  const s = count({ ...state, prod: target, history: [...state.history, { action: "rollback" as const, release: target }] }, "rollbacks");
  return [{ type: "rollback.done", state: s, packets: [packet("registry", "prod", target.digest.slice(7, 14), "value")], at: "prod", dur: 800 }];
};

export const configure = (state: CicdState, patch: CicdConfig): CicdFrame[] => [{ type: "config.changed", state: { ...state, ...patch }, packets: [], dur: 1, patch }];

export const runAll = (state: CicdState, ...actions: ((s: CicdState) => CicdFrame[] | null)[]) => {
  let s = state;
  const frames: CicdFrame[] = [];
  for (const action of actions) {
    const out = action(s) ?? [];
    frames.push(...out);
    s = out[out.length - 1]?.state ?? s;
  }
  return { state: s, frames };
};
