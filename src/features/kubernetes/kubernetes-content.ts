// Kubernetes's words, kept apart from its logic. `describe` narrates a frame
// from the state that frame holds, so the caption can't disagree with the simulation.
import { BROKEN, CAPACITY, EVICT_AFTER, MAX_PULLS, NOT_READY_AFTER, pending, reportedReady, serving } from "./kubernetes-engine";
import type { K8sEventType, K8sFrame, K8sNodeId, K8sState } from "./kubernetes-types";

const node = (id: string) => ({ name: id, sub: `Worker · ${CAPACITY} pod slots`, role: `A machine running a kubelet. The kubelet watches the API server for pods bound to ${id}, starts their containers, and reports back with a heartbeat and each pod's status. It never decides what should run.` });

export const ROLES: Record<K8sNodeId, { name: string; sub: string; role: string }> = {
  kubectl: { name: "kubectl", sub: "You", role: "Sends desired state to the API server and returns. “Three replicas of web:v2” is a record being written, not a command being run. Everything after that happens without you." },
  api: { name: "API server", sub: "+ etcd", role: "The only component that stores anything, and the only one the others talk to. Controllers, the scheduler and kubelets all read from it and write to it. None of them talk to each other." },
  controller: { name: "Controller", sub: "Deployment / ReplicaSet", role: "A loop: read the spec, count the pods, create or delete pods to close the gap. During an update it also decides how fast old pods can go." },
  scheduler: { name: "Scheduler", sub: "Placement", role: "Finds pods with no node and picks one with room, based on what the API server believes about each node. It binds the pod and moves on. It doesn't start anything." },
  node1: node("node1"),
  node2: node("node2"),
  node3: node("node3"),
};

type Note = [title: string, text: string];

const gap = (s: K8sState) => `Ready ${reportedReady(s)} of ${s.desired}${serving(s) !== reportedReady(s) ? `, but only ${serving(s)} really serving` : ""}.`;

const NOTES: Record<K8sEventType, (f: K8sFrame) => Note> = {
  ready: (f) => ["Converged", `Desired and actual state agree: ${f.state.desired} pods, all ready. Every loop is idle.`],
  "spec.scaled": (f) => [`Spec: replicas ${f.count}`, "kubectl only updated a number in the API server. The controller will notice on its next pass."],
  "spec.image": (f) => [`Spec: image web:${f.state.version}`, `The pod template changed. Pods running web:${f.state.previous} no longer match it.`],
  "spec.undo": (f) => [`Rolled back to web:${f.state.version}`, "rollout undo is just another spec change. Pods that don't match are replaced, the same way as any update."],
  "pod.deleted": (f) => [`${f.pods?.[0]} deleted`, "The pod is marked for termination. No one asked for a replacement."],
  "node.failed": (f) => [`${f.worker} loses power`, "A dead machine sends no message. Its pods stop working, but the API server still lists them as ready."],
  "node.restored": (f) => [`${f.worker} powers back on`, "Its kubelet will start sending heartbeats again."],
  "node.silent": (f) => [`No heartbeat from ${f.worker}`, `${f.count} tick${f.count === 1 ? "" : "s"} of silence. Could be a slow network, so nothing is done yet. ${gap(f.state)}`],
  "node.notready": (f) => [`${f.worker} marked NotReady`, `After ${NOT_READY_AFTER} silent ticks the node controller stops trusting it. Its pods are marked not ready, so they stop getting traffic, and the scheduler skips it.`],
  "pods.evicted": (f) => [`Pods on ${f.worker} given up`, `After ${EVICT_AFTER} ticks, ${f.pods?.join(", ") || "its pods"} are deleted from the API server. To the controller, that's just pods missing.`],
  "node.rejoined": (f) => [`${f.worker} is Ready again`, "It rejoins empty. Its old pods were replaced elsewhere, and nothing moves back by itself."],
  "kubelet.sync": (f) => kubeletNote(f),
  "pods.scheduled": (f) => [`${f.pods?.length} pod${f.pods?.length === 1 ? "" : "s"} placed`, `The scheduler binds ${f.pods?.join(", ")} to nodes with free slots. The kubelets there will pick them up.`],
  "pods.unschedulable": (f) => ["No room", `${f.pods?.join(", ")} can't fit on any ready node, so ${pending(f.state) === 1 ? "it stays" : "they stay"} Pending. Kubernetes won't make machines appear.`],
  "pods.created": (f) => [`Controller creates ${f.count} pod${f.count === 1 ? "" : "s"}`, `It counted fewer pods than the spec asks for. They start with no node.${f.state.pods.some((p) => p.version !== f.state.version && p.phase !== "Terminating") ? " During an update, only one extra at a time." : ""}`],
  "pods.removed": (f) => [`Controller removes ${f.pods?.join(", ")}`, f.state.pods.some((p) => p.version !== f.state.version && p.phase !== "Terminating")
    ? `A new pod is ready, so an old one can go without dropping below ${f.state.desired} ready.`
    : "More pods than the spec asks for, or pods from the old template. Least useful first."],
};

const kubeletNote = (f: K8sFrame): Note => {
  const failing = f.state.pods.filter((p) => p.phase === "ImagePullBackOff");
  if (failing.length && f.packets.some((p) => p.kind === "error")) return ["ImagePullBackOff", `web:${BROKEN} doesn't exist. The kubelet retries with growing delays (${MAX_PULLS} attempts shown) and the pod never becomes ready.`];
  return ["Kubelets report in", `Each node starts what's bound to it, stops what's being deleted, and reports when a readiness check passes. ${gap(f.state)}`];
};

export const describe = (frame: K8sFrame): Note => NOTES[frame.type](frame);

// The loop every controller runs. The panel highlights the part acting now.
export const LOOP = [
  "for (;;) {                                  // every controller is this loop",
  "  const want = await api.get(deployment);    // what you asked for",
  "  const have = await api.list(pods);         // what exists",
  "  if (have.length < want.replicas) api.create(newPod);",
  "  if (have.length > want.replicas) api.delete(extraPod);",
  "}",
  " ",
  "// scheduler:  pod.node == null   →  api.bind(pod, nodeWithRoom)",
  "// kubelet:    pod.node == me     →  start it, report status",
  "// node ctrl:  no heartbeat       →  NotReady, then evict",
];

export const LOOP_LINES: Partial<Record<K8sEventType, number[]>> = {
  "spec.scaled": [2], "spec.image": [2], "spec.undo": [2], "pod.deleted": [3],
  "pods.created": [3, 4], "pods.removed": [3, 5], "pods.scheduled": [8], "pods.unschedulable": [8],
  "kubelet.sync": [9], "node.silent": [10], "node.notready": [10], "pods.evicted": [10], "node.rejoined": [10],
};

// `kubectl get pods -o wide`, from live simulation state.
export const podTable = (s: K8sState) => {
  const pad = (v: string | number, n: number) => String(v).padEnd(n);
  const head = `${pad("NAME", 9)}${pad("READY", 7)}${pad("STATUS", 19)}${pad("AGE", 6)}${pad("IMAGE", 8)}NODE`;
  const rows = s.pods.map((p) => `${pad(p.name, 9)}${pad(p.ready ? "1/1" : "0/1", 7)}${pad(p.phase, 19)}${pad(`${s.tick - p.born}t`, 6)}${pad(p.version, 8)}${p.node ?? "<none>"}`);
  return { head, rows };
};

export const eventTable = (s: K8sState) => s.events.slice(-7).map((e) => `${`t${e.tick}`.padEnd(6)}${(e.warning ? "Warning" : "Normal").padEnd(9)}${e.reason.padEnd(22)}${e.object.padEnd(16)}${e.message}`);
