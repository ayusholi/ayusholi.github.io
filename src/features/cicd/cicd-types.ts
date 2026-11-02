import type { Packet, SimFrame } from "@/lib/simulation/simulation-types";

export type CicdNodeId = "dev" | "repo" | "ci" | "registry" | "staging" | "prod";
export type Change = "good" | "breaks-test" | "hidden-bug";
export type Strategy = "all" | "canary";
export type Gate = "auto" | "manual";
export type StageId = "build" | "test" | "publish" | "staging" | "approve" | "prod";
export type StageStatus = "pending" | "passed" | "failed" | "waiting" | "skipped";

export type Commit = { sha: string; message: string; change: Change };

// What runs in an environment: always an artifact from the registry.
export type Release = { sha: string; digest: string; bug: boolean };

export type Run = { id: number; sha: string; stages: Record<StageId, StageStatus>; digest: string | null };

export type CicdStats = { runs: number; failedRuns: number; deploys: number; rollbacks: number; badResponses: number };

export type CicdState = {
  commits: Commit[];
  runs: Run[];
  artifacts: Release[];      // everything ever published, never rebuilt
  staging: Release | null;
  prod: Release | null;
  history: { action: "deploy" | "canary" | "rollback" | "abort"; release: Release }[];
  strategy: Strategy;
  gate: Gate;
  waiting: number | null;    // a run held at the approval gate
  next: number;
  stats: CicdStats;
};

export type CicdEventType =
  | "ready" | "push" | "ci.triggered" | "build.passed" | "test.passed" | "test.failed" | "artifact.published"
  | "staging.deployed" | "staging.checked" | "gate.waiting" | "gate.approved" | "run.superseded"
  | "prod.deployed" | "prod.healthy" | "prod.errors" | "canary.deployed" | "canary.healthy" | "canary.failed" | "canary.promoted"
  | "rollback.done" | "config.changed";

export type CicdConfig = Partial<Pick<CicdState, "strategy" | "gate">>;

export type CicdFrame = SimFrame<CicdState> & {
  type: CicdEventType;
  packets: Packet<CicdNodeId>[];
  at?: CicdNodeId;
  run?: number;
  stage?: StageId;
  patch?: CicdConfig;
};

export type CicdAction = (state: CicdState) => CicdFrame[] | null;
