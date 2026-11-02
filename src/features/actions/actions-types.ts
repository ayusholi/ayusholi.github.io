import type { Packet, SimFrame } from "@/lib/simulation/simulation-types";

export type RunnerId = "r1" | "r2" | "r3";
export type ActionsNodeId = "dev" | "github" | "cache" | RunnerId;
export type JobId = "test-20" | "test-22" | "build" | "deploy";
export type JobStatus = "waiting" | "queued" | "running" | "success" | "failure" | "skipped" | "cancelled";
export type StepKind = "checkout" | "restore" | "install" | "test" | "save" | "build" | "upload" | "download" | "deploy";
export type StepStatus = "pending" | "running" | "success" | "failure" | "skipped";

export type Step = { kind: StepKind; name: string; status: StepStatus; left: number };

export type Job = {
  id: JobId;
  needs: JobId[];
  status: JobStatus;
  runner: RunnerId | null;
  steps: Step[];
  hit: boolean | null;      // what the cache said, once asked
};

export type Trigger = { event: "push" | "pull_request"; ref: string; failing: boolean; deps: boolean; docs: boolean };

export type Run = {
  id: number;
  sha: string;
  trigger: Trigger;
  status: "in_progress" | "success" | "failure" | "cancelled";
  jobs: Job[];
  lock: number;             // version of package-lock.json in this commit
};

export type ActionsStats = { runs: number; minutes: number; hits: number; misses: number; cancelled: number };

export type ActionsState = {
  runs: Run[];
  runners: { id: RunnerId; job: string | null }[];   // job is `${run}:${jobId}`
  capacity: number;                                  // runners available at once
  cache: string[];                                   // saved keys
  lock: number;
  next: number;
  tick: number;
  log: string[];
  stats: ActionsStats;
};

export type ActionsEventType =
  | "ready" | "event.received" | "event.ignored" | "run.created" | "run.cancelled"
  | "jobs.progress" | "jobs.resolved" | "jobs.dispatched" | "run.finished" | "config.changed";

export type ActionsFrame = SimFrame<ActionsState> & {
  type: ActionsEventType;
  packets: Packet<ActionsNodeId>[];
  at?: ActionsNodeId;
  run?: number;
  jobs?: string[];
  focus?: { job: JobId; step: StepKind };
  notes?: string[];
};

export type ActionsAction = (state: ActionsState) => ActionsFrame[] | null;
