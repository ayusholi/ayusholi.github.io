// GitHub Actions' words, kept apart from its logic. `describe` narrates a frame
// from the state that frame holds, so the caption can't disagree with the simulation.
import { findJob, INSTALL_COLD, JOB_NAME, latest, STEP_NAME } from "./actions-engine";
import type { ActionsEventType, ActionsFrame, ActionsNodeId, ActionsState, JobId, StepKind } from "./actions-types";

const runner = (n: number) => ({ name: `Runner ${n}`, sub: "ubuntu-latest", role: "A fresh virtual machine for exactly one job. It checks out the code, runs the steps in order and reports each one. Then it's destroyed: nothing on its disk is there for the next job." });

export const ROLES: Record<ActionsNodeId, { name: string; sub: string; role: string }> = {
  dev: { name: "You", sub: "git push", role: "Pushes a commit or opens a pull request. That's an event. Everything after it is decided by the workflow files in .github/workflows at that commit." },
  github: { name: "GitHub", sub: "Events · workflow runs", role: "Matches the event against each workflow's on: triggers, creates a run, works out which jobs are ready from their needs: and if:, and queues them for runners. It never runs your code itself." },
  cache: { name: "Cache · artifacts", sub: "Storage", role: "The only way to share files between jobs. The cache keeps dependencies between runs, under a key you choose. Artifacts pass build output from one job to another within a run." },
  r1: runner(1),
  r2: runner(2),
  r3: runner(3),
};

type Note = [title: string, text: string];

const NOTES: Record<ActionsEventType, (f: ActionsFrame) => Note> = {
  ready: () => ["Waiting for an event", "Workflows don't run on a schedule of their own here. Push something."],
  "event.received": (f) => ["An event arrives", `GitHub receives a ${f.packets[0]?.label} event and checks it against the on: block of every workflow file.`],
  "event.ignored": () => ["No workflow matched", "Only docs/ changed, and paths-ignore excludes it. No run, no runner, no minutes billed."],
  "run.created": (f) => {
    const r = latest(f.state);
    return [`Run #${r?.id} created`, `ci.yml matched. All four jobs exist from the start, waiting on their needs:.${r && r.lock > 1 && r.trigger.deps ? " This commit changes package-lock.json." : ""}`];
  },
  "run.cancelled": (f) => [`Run #${f.run} cancelled`, "Same concurrency group, newer commit. Its running jobs are stopped and their runners are released, so the newest code is what gets deployed."],
  "jobs.progress": (f) => progressNote(f),
  "jobs.resolved": (f) => ["Jobs re-evaluated", `${f.notes?.join(". ")}.`],
  "jobs.dispatched": (f) => [`${f.jobs?.join(", ")} → runner${f.jobs?.length === 1 ? "" : "s"}`, `Each job gets its own fresh machine.${queued(f.state) ? ` ${queued(f.state)} still queued: no free runner.` : ""}`],
  "run.finished": (f) => {
    const r = f.state.runs.find((x) => x.id === f.run);
    return [`Run #${f.run}: ${r?.status}`, r?.status === "success" ? "The commit gets a green check." : r?.status === "failure" ? "The commit gets a red cross, and the log shows the failing step." : "Cancelled runs aren't failures. The newer run carries on."];
  },
  "config.changed": (f) => [`${f.state.capacity} runner${f.state.capacity === 1 ? "" : "s"} available`, "How many jobs can run at the same time. The rest wait in the queue."],
};

const queued = (s: ActionsState) => s.runs.flatMap((r) => r.jobs).filter((j) => j.status === "queued").length;

const STEP_NOTES: Partial<Record<StepKind, string>> = {
  checkout: "A blank machine has no code on it. The first step of every job fetches the commit.",
  restore: "setup-node looks up the cache under a key built from a hash of package-lock.json.",
  test: "The tests run. Its exit code decides the job.",
  save: "After a miss, the downloaded dependencies are saved under the new key for later runs.",
  build: "Build output exists only on this machine, which is about to be destroyed.",
  upload: "So it's uploaded as an artifact, for the deploy job to download.",
  download: "deploy runs on a different machine, so it fetches the build from the artifact store.",
  deploy: "The only job allowed to touch production.",
};

const progressNote = (f: ActionsFrame): Note => {
  const busy = f.state.runners.filter((r) => findJob(f.state, r.job)).length;
  if (f.notes?.some((n) => n.includes("fail-fast"))) return ["npm test failed", `${f.notes.find((n) => n.includes("fail-fast"))}. Waiting for it would only spend minutes on a run that's already red.`];
  const miss = f.packets.find((p) => p.label === "miss");
  if (miss) return ["Cache miss", `No entry for this lockfile, so npm ci downloads every package: ${INSTALL_COLD} ticks instead of 1.`];
  if (f.packets.some((p) => p.label === "hit")) return ["Cache hit", "Dependencies are restored from the cache, so npm ci has almost nothing to download."];
  const job = f.focus ? JOB_NAME[f.focus.job as JobId] : "";
  return [`${busy} runner${busy === 1 ? "" : "s"} working · ${job}: ${f.focus ? STEP_NAME[f.focus.step] : ""}`, f.focus ? STEP_NOTES[f.focus.step] ?? "Steps run one after another, on the same machine." : ""];
};

export const describe = (frame: ActionsFrame): Note => NOTES[frame.type](frame);

export const WORKFLOW = [
  "on:",
  "  push: { branches: [main], paths-ignore: ['docs/**'] }",
  "  pull_request:",
  "concurrency: { group: ci-${{ github.ref }}, cancel-in-progress: true }",
  "jobs:",
  "  test:",
  "    strategy: { matrix: { node: [20, 22] }, fail-fast: true }",
  "    runs-on: ubuntu-latest",
  "    steps:",
  "      - uses: actions/checkout@v4",
  "      - uses: actions/setup-node@v4",
  "        with: { node-version: ${{ matrix.node }}, cache: npm }",
  "      - run: npm ci",
  "      - run: npm test",
  "  build:",
  "    needs: test",
  "    steps: [checkout, setup-node, npm ci, npm run build, upload-artifact]",
  "  deploy:",
  "    needs: build",
  "    if: github.ref == 'refs/heads/main'",
  "    steps: [download-artifact, ./deploy.sh]",
];

// Which lines of ci.yml a frame is about.
export const workflowLines = (f: ActionsFrame): number[] => {
  if (f.type === "event.received" || f.type === "event.ignored") return [1, 2, 3];
  if (f.type === "run.cancelled") return [4];
  if (f.type === "jobs.resolved") return f.notes?.some((n) => n.startsWith("deploy skipped: if")) ? [20] : [16, 19];
  if (f.type === "jobs.dispatched") return [8];
  if (f.type !== "jobs.progress" || !f.focus) return [];
  const { job, step } = f.focus;
  if (job === "deploy") return [21];
  if (job === "build") return [17];
  if (f.notes?.some((n) => n.includes("fail-fast"))) return [7, 14];
  return ({ checkout: [10], restore: [11, 12], install: [13], test: [14], save: [11, 12] } as Partial<Record<StepKind, number[]>>)[step] ?? [];
};
