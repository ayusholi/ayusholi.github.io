import type { Packet, SimFrame } from "@/lib/simulation/simulation-types";

export type DockerNodeId = "cli" | "daemon" | "registry" | "store" | "runtime" | "kernel";
export type ImageTag = "web:1.0" | "web:1.1" | "web:1.2";
export type MemoryLimit = 128 | 512;
export type RestartPolicy = "no" | "always";

// One read-only filesystem layer, made by one Dockerfile instruction.
export type Layer = { id: string; step: string; mb: number; line: number };

export type Container = {
  id: string;
  image: ImageTag;
  status: "running" | "exited";
  exitCode: number | null;
  pid: number;              // what the host sees; inside, the process is PID 1
  files: string[];          // written to the container's own writable layer
  volume: boolean;          // /app/data is a named volume
  memoryLimit: MemoryLimit;
  restarts: number;
};

export type DockerStats = { downloadedMb: number; reusedLayers: number; started: number; oomKills: number };

export type DockerState = {
  images: Record<ImageTag, string[]>;   // what the registry serves: tag -> layer ids
  local: string[];                      // layer ids already on this machine
  tags: ImageTag[];                     // tags pulled to this machine
  containers: Container[];
  volume: string[];                     // files in the named volume, which outlives containers
  image: ImageTag;
  memoryLimit: MemoryLimit;
  useVolume: boolean;
  restart: RestartPolicy;
  nextId: number;
  nextPid: number;
  nextFile: number;
  elapsed: number;                      // illustrative ms of the command in progress
  registryUsed: boolean;                // the command in progress went to the registry
  stats: DockerStats;
  log: string[];                        // what the terminal printed
};

export type DockerEventType =
  | "ready" | "run.requested" | "manifest.fetched" | "layers.checked" | "layer.pulling" | "layer.pulled"
  | "image.tagged" | "fs.mounted" | "runtime.create" | "kernel.namespaces" | "kernel.cgroup" | "process.started" | "run.done"
  | "exec.requested" | "file.written" | "memory.grew" | "memory.ok" | "oom.killed" | "container.restarted"
  | "rm.requested" | "container.removed" | "images.pruned" | "config.changed";

export type DockerConfig = Partial<Pick<DockerState, "image" | "memoryLimit" | "useVolume" | "restart">>;

export type DockerFrame = SimFrame<DockerState> & {
  type: DockerEventType;
  packets: Packet<DockerNodeId>[];
  at?: DockerNodeId;
  layer?: string;
  container?: string;
  file?: string;
  patch?: DockerConfig;
};

export type DockerAction = (state: DockerState) => DockerFrame[] | null;
