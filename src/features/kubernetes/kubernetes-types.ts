import type { Packet, SimFrame } from "@/lib/simulation/simulation-types";

export type WorkerId = "node1" | "node2" | "node3";
export type K8sNodeId = "kubectl" | "api" | "controller" | "scheduler" | WorkerId;
export type Version = "v1" | "v2" | "v3";   // v3's image tag doesn't exist
export type PodPhase = "Pending" | "ContainerCreating" | "Running" | "ImagePullBackOff" | "Terminating";

export type Pod = {
  name: string;
  version: Version;
  node: WorkerId | null;    // null until the scheduler binds it
  phase: PodPhase;
  ready: boolean;           // passing its readiness probe, as last reported
  born: number;             // tick it was created
  retries: number;          // image pulls attempted
  unschedulable: boolean;   // the scheduler found no room, and said so
};

export type Worker = {
  id: WorkerId;
  up: boolean;              // the machine is really running
  ready: boolean;           // what the control plane believes
  silent: number;           // ticks since its last heartbeat
};

export type K8sStats = { created: number; evicted: number };

export type K8sEvent = { tick: number; warning: boolean; reason: string; object: string; message: string };

export type K8sState = {
  desired: number;
  version: Version;
  previous: Version | null; // for `kubectl rollout undo`
  pods: Pod[];
  workers: Worker[];
  nextPod: number;
  tick: number;
  events: K8sEvent[];       // `kubectl get events`, newest last
  stats: K8sStats;
};

export type K8sEventType =
  | "ready" | "spec.scaled" | "spec.image" | "spec.undo" | "pod.deleted" | "node.failed" | "node.restored"
  | "node.silent" | "node.notready" | "pods.evicted" | "node.rejoined"
  | "kubelet.sync" | "pods.scheduled" | "pods.unschedulable" | "pods.created" | "pods.removed";

export type K8sFrame = SimFrame<K8sState> & {
  type: K8sEventType;
  packets: Packet<K8sNodeId>[];
  at?: K8sNodeId;
  worker?: WorkerId;
  pods?: string[];
  count?: number;
};

export type K8sAction = (state: K8sState) => K8sFrame[] | null;
