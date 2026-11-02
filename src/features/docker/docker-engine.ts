// =========================================================
// `docker run`, as a pure state model. No DOM, no timers.
//
// Models an image as a stack of content-addressed layers, a local
// layer store that is checked before anything is downloaded, a
// container as an ordinary process the kernel isolates with
// namespaces and limits with a cgroup, and a writable layer that
// lives and dies with its container.
// See docker-engine.test.ts.
//
// Simplified on purpose: one registry, no build step (the images
// already exist), no networking, no compression or parallel
// downloads, and timings that only show the shape of the cost.
// =========================================================

import type { Packet } from "@/lib/simulation/simulation-types";
import type { Container, DockerConfig, DockerEventType, DockerFrame, DockerNodeId, DockerState, ImageTag, Layer } from "./docker-types";

// Every layer the registry knows about. Ids stand in for sha256 digests:
// the same content always has the same id, whichever image it belongs to.
export const LAYERS: Record<string, Layer> = {
  a1f3: { id: "a1f3", step: "FROM node:22-slim", mb: 74, line: 1 },
  b7c2: { id: "b7c2", step: "RUN npm ci", mb: 41, line: 4 },
  c9e0: { id: "c9e0", step: "COPY . .", mb: 2, line: 5 },
  c4d8: { id: "c4d8", step: "COPY . .", mb: 2, line: 5 },
  e5a1: { id: "e5a1", step: "RUN npm ci", mb: 46, line: 4 },
  c2b6: { id: "c2b6", step: "COPY . .", mb: 2, line: 5 },
};

// 1.1 changes application code. 1.2 changes package.json, which sits above
// the code in the Dockerfile, so both of the later layers are new.
const IMAGES: Record<ImageTag, string[]> = {
  "web:1.0": ["a1f3", "b7c2", "c9e0"],
  "web:1.1": ["a1f3", "b7c2", "c4d8"],
  "web:1.2": ["a1f3", "e5a1", "c2b6"],
};

export const TAGS = Object.keys(IMAGES) as ImageTag[];
export const ALLOCATE_MB = 300;   // what "Spike memory" asks for

// Illustrative costs, in ms.
const COST = { api: 8, manifest: 120, perMb: 9, unpackPerMb: 2, overlay: 15, namespaces: 20, cgroup: 5, start: 40 };

export const createState = (patch: DockerConfig = {}): DockerState => ({
  images: IMAGES,
  local: [],
  tags: [],
  containers: [],
  volume: [],
  image: "web:1.0",
  memoryLimit: 512,
  useVolume: false,
  restart: "no",
  nextId: 1,
  nextPid: 4127,
  nextFile: 1,
  elapsed: 0,
  registryUsed: false,
  stats: { downloadedMb: 0, reusedLayers: 0, started: 0, oomKills: 0 },
  log: [],
  ...patch,
});

export const imageSize = (s: DockerState, tag: ImageTag) => s.images[tag].reduce((sum, id) => sum + (LAYERS[id]?.mb ?? 0), 0);
export const localMb = (s: DockerState) => s.local.reduce((sum, id) => sum + (LAYERS[id]?.mb ?? 0), 0);
export const running = (s: DockerState) => s.containers.filter((c) => c.status === "running");
export const newest = (s: DockerState, onlyRunning = false) => [...(onlyRunning ? running(s) : s.containers)].pop();

const packet = (from: DockerNodeId, to: DockerNodeId, label: string, kind: Packet["kind"] = "request"): Packet<DockerNodeId> => ({ from, to, label, kind });

// A command is built as a chain: each step transforms the state and emits one frame.
const chain = (state: DockerState) => {
  let s: DockerState = { ...state, elapsed: 0, registryUsed: false };
  const frames: DockerFrame[] = [];
  const step = (type: DockerEventType, at: DockerNodeId, packets: Packet<DockerNodeId>[], ms: number, patch: (st: DockerState) => DockerState = (st) => st, meta: Partial<DockerFrame> = {}) => {
    s = patch({ ...s, elapsed: s.elapsed + ms });
    frames.push({ type, state: s, packets, at, dur: Math.max(450, Math.min(1400, 380 + ms)), ...meta });
  };
  return { step, get state() { return s; }, frames };
};

const print = (...lines: string[]) => (s: DockerState): DockerState => ({ ...s, log: [...s.log, ...lines].slice(-14) });

const setContainer = (s: DockerState, id: string, patch: Partial<Container>): DockerState => ({
  ...s, containers: s.containers.map((c) => (c.id === id ? { ...c, ...patch } : c)),
});

// ---------- docker run ----------
export const run = (state: DockerState): DockerFrame[] => {
  const tag = state.image;
  const c = chain(state);
  c.step("run.requested", "daemon", [packet("cli", "daemon", "POST /create")], COST.api, print(`$ docker run -d -m ${state.memoryLimit}m${state.useVolume ? " -v data:/app/data" : ""} ${tag}`));

  if (!c.state.tags.includes(tag)) {
    c.step("manifest.fetched", "registry", [packet("daemon", "registry", "GET manifest"), packet("registry", "daemon", `${state.images[tag].length} layers`, "value")], COST.manifest,
      (s) => print(`Unable to find image '${tag}' locally`, `${tag.split(":")[1]}: Pulling from web`)({ ...s, registryUsed: true }));
  }

  const missing = state.images[tag].filter((id) => !c.state.local.includes(id));
  const reused = state.images[tag].length - missing.length;
  c.step("layers.checked", "store", [packet("daemon", "store", "have layers?"), packet("store", "daemon", `${reused} of ${state.images[tag].length}`, reused ? "value" : "miss")], COST.api,
    (s) => ({ ...s, stats: { ...s.stats, reusedLayers: s.stats.reusedLayers + reused } }),
    { layer: state.images[tag].find((id) => !missing.includes(id)) });

  for (const id of missing) {
    const layer = LAYERS[id] as Layer;
    c.step("layer.pulling", "registry", [packet("daemon", "registry", `GET ${id}`)], COST.api, (s) => s, { layer: id });
    c.step("layer.pulled", "store", [packet("registry", "daemon", `${layer.mb} MB`, "value"), packet("daemon", "store", `unpack ${id}`, "command")], layer.mb * (COST.perMb + COST.unpackPerMb),
      (s) => print(`${id}: Pull complete`)({ ...s, registryUsed: true, local: [...s.local, id], stats: { ...s.stats, downloadedMb: s.stats.downloadedMb + layer.mb } }), { layer: id });
  }
  if (!c.state.tags.includes(tag)) c.step("image.tagged", "store", [], 1, (s) => print(`Status: Downloaded newer image for ${tag}`)({ ...s, tags: [...s.tags, tag] }));

  const id = `c${c.state.nextId}`;
  const pid = c.state.nextPid;
  const container: Container = { id, image: tag, status: "exited", exitCode: null, pid, files: [], volume: state.useVolume, memoryLimit: state.memoryLimit, restarts: 0 };
  c.step("fs.mounted", "store", [packet("daemon", "store", "+ rw layer", "command")], COST.overlay,
    (s) => ({ ...s, containers: [...s.containers, container], nextId: s.nextId + 1, nextPid: s.nextPid + 3 }), { container: id });
  c.step("runtime.create", "runtime", [packet("daemon", "runtime", `create ${id}`, "command")], COST.api, (s) => s, { container: id });
  c.step("kernel.namespaces", "kernel", [packet("runtime", "kernel", "clone(NEW*)", "command")], COST.namespaces, (s) => s, { container: id });
  c.step("kernel.cgroup", "kernel", [packet("runtime", "kernel", `max ${state.memoryLimit}M`, "command")], COST.cgroup, (s) => s, { container: id });
  c.step("process.started", "runtime", [packet("kernel", "runtime", `pid ${pid}`, "value")], COST.start,
    (s) => setContainer({ ...s, stats: { ...s.stats, started: s.stats.started + 1 } }, id, { status: "running" }), { container: id });
  c.step("run.done", "cli", [packet("runtime", "daemon", "started", "value"), packet("daemon", "cli", id, "value")], COST.api, print(id), { container: id });
  return c.frames;
};

// ---------- docker exec: write a file ----------
export const writeFile = (state: DockerState): DockerFrame[] | null => {
  const target = newest(state, true);
  if (!target) return null;
  const file = `note-${state.nextFile}.txt`;
  const c = chain(state);
  c.step("exec.requested", "runtime", [packet("cli", "daemon", "exec"), packet("daemon", "runtime", "write file", "command")], COST.api,
    print(`$ docker exec ${target.id} sh -c 'date > data/${file}'`), { container: target.id, file });
  c.step("file.written", "store", [packet("runtime", "store", target.volume ? "→ volume" : "→ rw layer", "command")], COST.api, (s) => {
    const next = { ...s, nextFile: s.nextFile + 1 };
    return target.volume ? { ...next, volume: [...next.volume, file] } : setContainer(next, target.id, { files: [...target.files, file] });
  }, { container: target.id, file });
  return c.frames;
};

// ---------- a process asks for more memory than its cgroup allows ----------
export const spikeMemory = (state: DockerState): DockerFrame[] | null => {
  const target = newest(state, true);
  if (!target) return null;
  const c = chain(state);
  c.step("memory.grew", "kernel", [packet("runtime", "kernel", `malloc ${ALLOCATE_MB}M`, "command")], COST.api, (s) => s, { container: target.id });
  if (ALLOCATE_MB <= target.memoryLimit) {
    c.step("memory.ok", "kernel", [packet("kernel", "runtime", "granted", "value")], COST.api, (s) => s, { container: target.id });
    return c.frames;
  }
  c.step("oom.killed", "runtime", [packet("kernel", "runtime", "SIGKILL", "error")], COST.api,
    (s) => print(`${target.id} exited (137): OOMKilled`)(setContainer({ ...s, stats: { ...s.stats, oomKills: s.stats.oomKills + 1 } }, target.id, { status: "exited", exitCode: 137 })),
    { container: target.id });
  if (state.restart === "always") {
    const pid = c.state.nextPid;
    c.step("container.restarted", "kernel", [packet("daemon", "runtime", "restart", "command"), packet("runtime", "kernel", "clone(NEW*)", "command")], COST.namespaces + COST.start,
      (s) => setContainer({ ...s, nextPid: s.nextPid + 3 }, target.id, { status: "running", exitCode: null, pid, restarts: target.restarts + 1 }), { container: target.id });
  }
  return c.frames;
};

// ---------- docker rm -f ----------
export const remove = (state: DockerState): DockerFrame[] | null => {
  const target = newest(state);
  if (!target) return null;
  const c = chain(state);
  c.step("rm.requested", "runtime", [packet("cli", "daemon", `rm -f ${target.id}`), ...(target.status === "running" ? [packet("daemon", "runtime", "SIGKILL", "error")] : [])], COST.api,
    print(`$ docker rm -f ${target.id}`), { container: target.id });
  c.step("container.removed", "store", [packet("daemon", "store", "drop rw layer", "command")], COST.overlay,
    (s) => print(target.id)({ ...s, containers: s.containers.filter((x) => x.id !== target.id) }), { container: target.id });
  return c.frames;
};

// ---------- docker image prune -a ----------
// Layers still under a container stay. Everything else goes.
export const prune = (state: DockerState): DockerFrame[] => {
  const used = new Set(state.containers.flatMap((c) => state.images[c.image]));
  const tags = state.tags.filter((t) => state.containers.some((c) => c.image === t));
  const s = print("$ docker image prune -a", `Total reclaimed space: ${state.local.filter((id) => !used.has(id)).reduce((n, id) => n + (LAYERS[id]?.mb ?? 0), 0)} MB`)({ ...state, registryUsed: false, local: state.local.filter((id) => used.has(id)), tags });
  return [{ type: "images.pruned", state: s, packets: [packet("daemon", "store", "prune", "command")], at: "store", dur: 600 }];
};

export const configure = (state: DockerState, patch: DockerConfig): DockerFrame[] => [{ type: "config.changed", state: { ...state, ...patch }, packets: [], dur: 1, patch }];

// Applies actions one after another, collecting every frame. Used by scenarios and tests.
export const runAll = (state: DockerState, ...actions: ((s: DockerState) => DockerFrame[] | null)[]) => {
  let s = state;
  const frames: DockerFrame[] = [];
  for (const action of actions) {
    const out = action(s) ?? [];
    frames.push(...out);
    s = out[out.length - 1]?.state ?? s;
  }
  return { state: s, frames };
};

// What a process inside the container can see of the filesystem.
export const filesSeenBy = (s: DockerState, c: Container) => (c.volume ? [...s.volume, ...c.files] : c.files);
