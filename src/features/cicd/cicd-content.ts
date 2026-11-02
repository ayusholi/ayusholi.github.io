// CI/CD's words, kept apart from its logic. `describe` narrates a frame from
// the state that frame holds, so the caption can't disagree with the simulation.
import { CANARY_SHARE, releaseOf, runOf } from "./cicd-engine";
import type { CicdEventType, CicdFrame, CicdNodeId, CicdState, StageId } from "./cicd-types";

export const ROLES: Record<CicdNodeId, { name: string; sub: string; role: string }> = {
  dev: { name: "Developer", sub: "A laptop", role: "Where changes start. In a working pipeline, the last thing a developer does by hand is push, or approve a release. Nothing is copied to a server from here." },
  repo: { name: "Git repo", sub: "main branch", role: "The source of truth for code. A push to main fires a webhook that starts the pipeline, and the pipeline reports its result back as a status on the commit." },
  ci: { name: "CI server", sub: "Build · test · gate", role: "Runs the pipeline in clean, throwaway environments: compile, run the tests, publish an artifact, and hold or release it at the gate. Stops the line on the first failure." },
  registry: { name: "Registry", sub: "Artifacts", role: "Keeps every artifact the pipeline has published, named by a content digest. Environments pull from here, so staging and production run byte-for-byte the same build." },
  staging: { name: "Staging", sub: "Rehearsal", role: "A production-like environment for smoke tests. It catches a build that won't start or can't reach its database. It has no real users, so it can't catch everything." },
  prod: { name: "Production", sub: "Real users", role: "Receives a release by pulling an artifact from the registry. A rollback is the same operation with an older digest: nothing is rebuilt." },
};

type Note = [title: string, text: string];

const sha = (f: CicdFrame) => runOf(f.state, f.run ?? null)?.sha ?? "";
const digest = (f: CicdFrame) => releaseOf(f.state, runOf(f.state, f.run ?? null))?.digest.slice(0, 14) ?? "";

const NOTES: Record<CicdEventType, (f: CicdFrame) => Note> = {
  ready: (f) => ["Ready", f.state.prod ? `Production runs ${f.state.prod.sha}. Push a change and follow it.` : "Push a change and follow it."],
  push: (f) => [`git push ${f.state.commits[f.state.commits.length - 1]?.sha}`, `“${f.state.commits[f.state.commits.length - 1]?.message}”. The developer's part is done.`],
  "ci.triggered": (f) => [`Pipeline #${f.run} starts`, "GitHub, GitLab or similar calls the CI server. It checks out exactly this commit in a fresh environment."],
  "build.passed": () => ["Build passes", "It compiles. The build happens once per commit, here, and never again further down the line."],
  "test.passed": () => ["Tests pass", "The commit gets a green check. Good tests are why the rest of this can be automatic."],
  "test.failed": (f) => ["A test fails: the line stops", `Commit ${sha(f)} gets a red cross. Nothing is published, so nothing can be deployed. Fixing it costs one developer a few minutes.`],
  "artifact.published": (f) => ["Artifact published", `${digest(f)}… is now immutable. Every environment after this point runs these exact bytes.`],
  "staging.deployed": () => ["Deployed to staging", "Pulled from the registry, the way production will do it."],
  "staging.checked": (f) => ["Smoke tests pass", releaseOf(f.state, runOf(f.state, f.run ?? null))?.bug
    ? "It starts and answers its health check. The bug is still in there: it needs real traffic to show."
    : "It starts and answers its health check."],
  "gate.waiting": () => ["Waiting for approval", "Everything up to here was automatic. Releasing is now a decision, not a project."],
  "gate.approved": (f) => (f.state.gate === "manual" ? ["Approved", "A person released it."] : ["No gate", "Continuous deployment: every green commit goes to production by itself."]),
  "run.superseded": (f) => [`Pipeline #${f.run} superseded`, "A newer commit arrived before it was approved. It will never be released."],
  "prod.deployed": (f) => ["Released to everyone", `All production traffic now goes to ${f.state.prod?.sha}.`],
  "prod.healthy": () => ["Production is healthy", "Error rate unchanged. Done: from push to production with no hand-offs."],
  "prod.errors": () => ["Every request is failing", "100% of traffic got the bug at once. The fix is a rollback, and the time it takes is all user-facing."],
  "canary.deployed": () => ["Canary released", `${CANARY_SHARE}% of traffic goes to the new release. The rest stays on the old one.`],
  "canary.healthy": () => ["The canary looks healthy", "Its error rate matches the old release's. Safe to continue."],
  "canary.failed": () => ["The canary is failing", `Its error rate jumps. ${CANARY_SHARE} requests in every 100 got the bug.`],
  "canary.promoted": (f) => ["Promoted to 100%", `${f.state.prod?.sha} now takes all traffic.`],
  "rollback.done": (f) => (f.run
    ? ["Aborted automatically", "The canary is withdrawn and all traffic stays on the release that already worked. Nothing needed rebuilding."]
    : ["Rolled back", `Production pulls ${f.state.prod?.digest.slice(0, 14)}… again, an artifact that already exists. That's why it takes seconds.`]),
  "config.changed": ({ patch = {} }) => (patch.strategy
    ? [patch.strategy === "canary" ? "Strategy: canary" : "Strategy: all at once", patch.strategy === "canary" ? `New releases take ${CANARY_SHARE}% of traffic first.` : "New releases take all traffic immediately."]
    : [patch.gate === "manual" ? "Gate: manual approval" : "Gate: automatic", patch.gate === "manual" ? "Green runs wait for a person before production." : "Green runs go to production by themselves."]),
};

export const describe = (frame: CicdFrame): Note => NOTES[frame.type](frame);

export const PIPELINE = [
  "on: push to main",
  "build:    compile                → once per commit",
  "test:     unit + integration     → red stops the line",
  "publish:  image@sha256:…         → immutable artifact",
  "staging:  deploy that artifact   → smoke tests",
  "approve:  a person, or a rule",
  "prod:     deploy that artifact   → watch the error rate",
];

export const PIPELINE_LINE: Record<StageId, number> = { build: 2, test: 3, publish: 4, staging: 5, approve: 6, prod: 7 };

// `deploy history production`, newest first.
export const historyLines = (s: CicdState) => [...s.history].reverse().slice(0, 7).map((h) =>
  `${h.action.padEnd(10)}${h.release.sha.padEnd(10)}${h.release.digest.slice(0, 14)}…${h.action === "canary" ? `  (${CANARY_SHARE}%)` : ""}`);
