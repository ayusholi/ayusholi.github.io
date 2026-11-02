// =========================================================
// A GitHub Actions workflow run, as a pure state model. No DOM, no timers.
//
// Models an event matched against a workflow's triggers, a run of
// jobs whose `needs` form a graph, a matrix with fail-fast, an `if:`
// that skips a job, a concurrency group that cancels older runs,
// a fixed pool of runners where every job gets a fresh machine, and
// a dependency cache keyed on the lockfile.
// See actions-engine.test.ts.
//
// Simplified on purpose: one workflow file, steps measured in ticks
// rather than minutes, three runners at most, and a cache that never
// evicts anything.
// =========================================================

import type { Packet } from "@/lib/simulation/simulation-types";
import type { ActionsEventType, ActionsFrame, ActionsNodeId, ActionsState, Job, JobId, Run, RunnerId, Step, StepKind, Trigger } from "./actions-types";

export const RUNNERS: RunnerId[] = ["r1", "r2", "r3"];
export const JOBS: JobId[] = ["test-20", "test-22", "build", "deploy"];
export const JOB_NAME: Record<JobId, string> = { "test-20": "test (20)", "test-22": "test (22)", build: "build", deploy: "deploy" };
export const STEP_NAME: Record<StepKind, string> = {
  checkout: "checkout", restore: "setup-node", install: "npm ci", test: "npm test", save: "save cache",
  build: "npm run build", upload: "upload-artifact", download: "download-artifact", deploy: "./deploy.sh",
};
export const INSTALL_COLD = 3;   // ticks for npm ci without a cache
const TICKS: Record<StepKind, number> = { checkout: 1, restore: 1, install: 1, test: 2, save: 1, build: 2, upload: 1, download: 1, deploy: 2 };

const PLAN: Record<JobId, { needs: JobId[]; steps: StepKind[] }> = {
  "test-20": { needs: [], steps: ["checkout", "restore", "install", "test", "save"] },
  "test-22": { needs: [], steps: ["checkout", "restore", "install", "test", "save"] },
  build: { needs: ["test-20", "test-22"], steps: ["checkout", "restore", "install", "build", "upload"] },
  deploy: { needs: ["build"], steps: ["download", "deploy"] },
};

const TERMINAL = ["success", "failure", "skipped", "cancelled"];
export const isDone = (j: Job) => TERMINAL.includes(j.status);

const hex = (n: number) => ((Math.imul(n + 3, 2654435761) >>> 0).toString(16) + "0000000").slice(0, 7);
export const cacheKey = (lock: number) => `npm-${lock}`;

export const createState = ({ capacity = 2 }: { capacity?: number } = {}): ActionsState => ({
  runs: [],
  runners: RUNNERS.map((id) => ({ id, job: null })),
  capacity,
  cache: [cacheKey(1)],
  lock: 1,
  next: 1,
  tick: 0,
  log: [],
  stats: { runs: 0, minutes: 0, hits: 0, misses: 0, cancelled: 0 },
});

const packet = (from: ActionsNodeId, to: ActionsNodeId, label: string, kind: Packet["kind"] = "request"): Packet<ActionsNodeId> => ({ from, to, label, kind });
const frame = (type: ActionsEventType, state: ActionsState, meta: Partial<ActionsFrame> = {}): ActionsFrame => ({ type, state, packets: [], dur: 650, ...meta });
const say = (s: ActionsState, line: string): ActionsState => ({ ...s, log: [...s.log, line].slice(-10) });

const setJob = (s: ActionsState, run: number, id: JobId, patch: Partial<Job>): ActionsState => ({
  ...s, runs: s.runs.map((r) => (r.id === run ? { ...r, jobs: r.jobs.map((j) => (j.id === id ? { ...j, ...patch } : j)) } : r)),
});
const free = (s: ActionsState, key: string): ActionsState => ({ ...s, runners: s.runners.map((r) => (r.job === key ? { ...r, job: null } : r)) });
const jobKey = (run: number, id: JobId) => `${run}:${id}`;
export const findJob = (s: ActionsState, key: string | null) => {
  if (!key) return null;
  const [run, id] = key.split(":");
  const r = s.runs.find((x) => x.id === Number(run));
  return r ? { run: r, job: r.jobs.find((j) => j.id === id) as Job } : null;
};

// Stops a job wherever it is, and gives its runner back.
const cancelJob = (s: ActionsState, run: number, j: Job): ActionsState => {
  const next = setJob(s, run, j.id, { status: "cancelled", runner: null, steps: j.steps.map((st) => (st.status === "pending" || st.status === "running" ? { ...st, status: "skipped" } : st)) });
  return { ...free(next, jobKey(run, j.id)), stats: { ...next.stats, cancelled: next.stats.cancelled + 1 } };
};

// ---------- Events ----------
export const trigger = (state: ActionsState, t: Partial<Trigger> = {}): ActionsFrame[] => {
  const tr: Trigger = { event: "push", ref: "main", failing: false, deps: false, docs: false, ...t };
  const sha = hex(state.next);
  const label = tr.event === "push" ? `push ${tr.ref}` : "pull_request";
  const frames: ActionsFrame[] = [];
  let s = { ...state, next: state.next + 1 };
  frames.push(frame("event.received", s, { at: "github", packets: [packet("dev", "github", label)] }));

  // on.push.paths-ignore: a commit that only touches docs/ matches no trigger.
  if (tr.docs) {
    s = say(s, `${sha} ${label}: no workflow matched (paths-ignore: docs/**)`);
    return [...frames, frame("event.ignored", s, { at: "github" })];
  }

  // concurrency: one run per ref, and a newer one cancels the older.
  const older = s.runs.filter((r) => r.status === "in_progress" && r.trigger.ref === tr.ref);
  if (older.length) {
    const packets: Packet<ActionsNodeId>[] = [];
    for (const r of older) {
      for (const j of r.jobs) {
        if (isDone(j)) continue;
        if (j.runner) packets.push(packet("github", j.runner, "cancel", "error"));
        s = cancelJob(s, r.id, j);
      }
      s = say({ ...s, runs: s.runs.map((x) => (x.id === r.id ? { ...x, status: "cancelled" } : x)) }, `#${r.id} cancelled: a newer run in group ci-${tr.ref}`);
    }
    frames.push(frame("run.cancelled", s, { at: "github", run: older[0]?.id, packets }));
  }

  const lock = tr.deps ? s.lock + 1 : s.lock;
  const run: Run = {
    id: state.next, sha, trigger: tr, status: "in_progress", lock,
    jobs: JOBS.map((id) => ({ id, needs: PLAN[id].needs, status: "waiting", runner: null, hit: null, steps: PLAN[id].steps.map((kind) => ({ kind, name: STEP_NAME[kind], status: "pending", left: 0 })) })),
  };
  s = say({ ...s, lock, runs: [...s.runs, run].slice(-4), stats: { ...s.stats, runs: s.stats.runs + 1 } }, `#${run.id} ${sha} ${label}: ci.yml matched`);
  frames.push(frame("run.created", s, { at: "github", run: run.id }));
  return frames;
};

// ---------- One tick of every runner, then the scheduler ----------
const stepTicks = (j: Job, kind: StepKind) => (kind === "install" && !j.hit ? INSTALL_COLD : TICKS[kind]);

const progress = (state: ActionsState): ActionsFrame | null => {
  let s = state;
  const packets: Packet<ActionsNodeId>[] = [];
  const notes: string[] = [];
  let focus: ActionsFrame["focus"];
  let at: ActionsNodeId | undefined;

  for (const runner of state.runners) {
    const found = findJob(s, runner.job);
    if (!found || found.job.status !== "running") continue;
    const { run, job } = found;
    const index = job.steps.findIndex((st) => st.status === "pending" || st.status === "running");
    const step = job.steps[index] as Step;
    focus ??= { job: job.id, step: step.kind };
    at ??= runner.id;
    s = { ...s, stats: { ...s.stats, minutes: s.stats.minutes + 1 } };
    const left = (step.status === "pending" ? stepTicks(job, step.kind) : step.left) - 1;
    let patch: Partial<Job> = {};
    let outcome: Step["status"] = left > 0 ? "running" : "success";

    if (left <= 0) {
      if (step.kind === "restore") {
        const hit = s.cache.includes(cacheKey(run.lock));
        patch = { hit };
        s = { ...s, stats: { ...s.stats, hits: s.stats.hits + (hit ? 1 : 0), misses: s.stats.misses + (hit ? 0 : 1) } };
        packets.push(packet("cache", runner.id, hit ? "hit" : "miss", hit ? "value" : "miss"));
      } else if (step.kind === "test" && run.trigger.failing) {
        outcome = "failure";
        packets.push(packet(runner.id, "github", "✕ npm test", "error"));
      } else if (step.kind === "save") {
        // setup-node only saves after a miss, and a key is never overwritten.
        if (job.hit || s.cache.includes(cacheKey(run.lock))) outcome = "skipped";
        else { s = { ...s, cache: [...s.cache, cacheKey(run.lock)] }; packets.push(packet(runner.id, "cache", cacheKey(run.lock), "command")); }
      } else if (step.kind === "upload") packets.push(packet(runner.id, "cache", "dist.zip", "command"));
      else if (step.kind === "download") packets.push(packet("cache", runner.id, "dist.zip", "value"));
      else if (step.kind === "deploy") packets.push(packet(runner.id, "github", "deployed", "value"));
    }

    const steps = job.steps.map((st, i) => (i === index ? { ...st, status: outcome, left: Math.max(0, left) } : st));
    const last = index === steps.length - 1;
    if (outcome === "failure") {
      s = setJob(s, run.id, job.id, { ...patch, status: "failure", runner: null, steps: steps.map((st, i) => (i > index ? { ...st, status: "skipped" } : st)) });
      s = say(free(s, runner.job as string), `#${run.id} ${JOB_NAME[job.id]} failed at ${step.name}`);
      // strategy.fail-fast: the other leg of the matrix is cancelled.
      if (job.id.startsWith("test-")) {
        const sibling = run.jobs.find((j) => j.id.startsWith("test-") && j.id !== job.id && !isDone(j));
        if (sibling) {
          if (sibling.runner) packets.push(packet("github", sibling.runner, "cancel", "error"));
          s = cancelJob(s, run.id, sibling);
          notes.push(`${JOB_NAME[sibling.id]} cancelled by fail-fast`);
        }
      }
    } else if (last && outcome !== "running") {
      s = setJob(s, run.id, job.id, { ...patch, status: "success", runner: null, steps });
      s = free(s, runner.job as string);
      notes.push(`${JOB_NAME[job.id]} done, its runner is thrown away`);
    } else {
      s = setJob(s, run.id, job.id, { ...patch, steps });
    }
  }
  return focus ? frame("jobs.progress", s, { at, focus, packets, notes }) : null;
};

const deployAllowed = (r: Run) => r.trigger.event === "push" && r.trigger.ref === "main";

// Jobs whose `needs` have all finished either queue or are skipped.
const resolve = (state: ActionsState): ActionsFrame | null => {
  let s = state;
  const notes: string[] = [];
  for (const run of state.runs.filter((r) => r.status === "in_progress")) {
    for (const job of run.jobs.filter((j) => j.status === "waiting")) {
      const needs = job.needs.map((id) => run.jobs.find((j) => j.id === id) as Job);
      const latest = s.runs.find((r) => r.id === run.id)?.jobs ?? run.jobs;
      const states = needs.map((n) => (latest.find((j) => j.id === n.id) as Job).status);
      if (states.some((st) => st === "failure" || st === "cancelled" || st === "skipped")) {
        s = setJob(s, run.id, job.id, { status: "skipped", steps: job.steps.map((st) => ({ ...st, status: "skipped" })) });
        notes.push(`${JOB_NAME[job.id]} skipped: a job it needs didn't succeed`);
      } else if (states.every((st) => st === "success")) {
        if (job.id === "deploy" && !deployAllowed(run)) {
          s = setJob(s, run.id, job.id, { status: "skipped", steps: job.steps.map((st) => ({ ...st, status: "skipped" })) });
          notes.push("deploy skipped: if: github.ref == 'refs/heads/main' is false");
        } else {
          s = setJob(s, run.id, job.id, { status: "queued" });
          notes.push(`${JOB_NAME[job.id]} queued`);
        }
      }
    }
  }
  return notes.length ? frame("jobs.resolved", s, { at: "github", notes }) : null;
};

// Queued jobs go to free runners, oldest run first. Each gets a fresh machine.
const dispatch = (state: ActionsState): ActionsFrame | null => {
  let s = state;
  const packets: Packet<ActionsNodeId>[] = [];
  const jobs: string[] = [];
  for (const run of state.runs) {
    for (const job of run.jobs.filter((j) => j.status === "queued")) {
      const runner = s.runners.slice(0, s.capacity).find((r) => !r.job);
      if (!runner) break;
      s = setJob({ ...s, runners: s.runners.map((r) => (r.id === runner.id ? { ...r, job: jobKey(run.id, job.id) } : r)) }, run.id, job.id, { status: "running", runner: runner.id });
      packets.push(packet("github", runner.id, JOB_NAME[job.id], "command"));
      jobs.push(JOB_NAME[job.id]);
    }
  }
  return jobs.length ? frame("jobs.dispatched", s, { at: packets[0]?.to, packets, jobs }) : null;
};

const finish = (state: ActionsState): ActionsFrame | null => {
  const done = state.runs.find((r) => r.status === "in_progress" && r.jobs.every(isDone));
  if (!done) return null;
  const status = done.jobs.some((j) => j.status === "failure") ? "failure" : done.jobs.some((j) => j.status === "cancelled") ? "cancelled" : "success";
  const s = say({ ...state, runs: state.runs.map((r) => (r.id === done.id ? { ...r, status } : r)) }, `#${done.id} ${status}`);
  return frame("run.finished", s, { at: "dev", run: done.id, packets: [packet("github", "dev", status === "success" ? "✓ checks" : "✕ checks", status === "success" ? "value" : "error")] });
};

// One unit of time. Returns null when every run has finished.
export const tick = (state: ActionsState): ActionsFrame[] | null => {
  let s = { ...state, tick: state.tick + 1 };
  const frames: ActionsFrame[] = [];
  for (const phase of [progress, resolve, dispatch, finish]) {
    const f = phase(s);
    if (f) { frames.push(f); s = f.state; }
  }
  return frames.length ? frames : null;
};

export const configure = (state: ActionsState, capacity: number): ActionsFrame[] => [frame("config.changed", { ...state, capacity }, { dur: 1 })];

export const lastState = (frames: ActionsFrame[], fallback: ActionsState) => frames[frames.length - 1]?.state ?? fallback;

export const settle = (state: ActionsState, limit = 300) => {
  let s = state;
  for (let i = 0; i < limit; i++) {
    const out = tick(s);
    if (!out) break;
    s = lastState(out, s);
  }
  return s;
};

export const ticks = (state: ActionsState, count: number) => {
  let s = state;
  for (let i = 0; i < count; i++) s = lastState(tick(s) ?? [], s);
  return s;
};

export const latest = (s: ActionsState) => s.runs[s.runs.length - 1];
export const jobOf = (r: Run | undefined, id: JobId) => r?.jobs.find((j) => j.id === id);
