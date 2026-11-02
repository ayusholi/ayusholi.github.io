// Docker's words, kept apart from its logic. `describe` narrates a frame from
// the state that frame holds, so the caption can't disagree with the simulation.
import { ALLOCATE_MB, imageSize, LAYERS } from "./docker-engine";
import type { DockerEventType, DockerFrame, DockerNodeId } from "./docker-types";

export const ROLES: Record<DockerNodeId, { name: string; sub: string; role: string }> = {
  cli: { name: "docker CLI", sub: "Your terminal", role: "A thin client. It turns your command into an HTTP request to the daemon's API and prints what comes back. It doesn't run anything itself." },
  daemon: { name: "dockerd", sub: "The daemon", role: "Does the actual work: resolves the image, fetches missing layers, prepares a filesystem and asks the runtime to start a process." },
  registry: { name: "Registry", sub: "Docker Hub, GHCR…", role: "Stores images as a manifest plus a list of layer blobs, each addressed by a hash of its content. Same content, same address, wherever it's used." },
  store: { name: "Layer store", sub: "On local disk", role: "Read-only layers, unpacked once and shared by every image and container that uses them. Each container gets one thin writable layer on top, stacked with overlayfs." },
  runtime: { name: "containerd + runc", sub: "Runtime", role: "containerd supervises containers. runc makes the system calls that create one, then gets out of the way, leaving an ordinary Linux process." },
  kernel: { name: "Linux kernel", sub: "Shared by everyone", role: "There's no separate OS per container. Namespaces limit what a process can see, and cgroups limit what it can use. All containers share this one kernel." },
};

type Note = [title: string, text: string];

const took = (f: DockerFrame) => `${f.state.elapsed} ms so far (illustrative)`;

const NOTES: Record<DockerEventType, (f: DockerFrame) => Note> = {
  ready: () => ["Ready", "Run the image and follow the command through each part."],
  "run.requested": (f) => ["The CLI calls the daemon", `docker run is a request to the daemon's API: create a container from ${f.state.image}, then start it.`],
  "manifest.fetched": (f) => ["The manifest arrives", `${f.state.image} isn't on this machine. The registry sends its manifest: a list of ${f.state.images[f.state.image].length} layer digests, ${imageSize(f.state, f.state.image)} MB in all.`],
  "layers.checked": (f) => {
    const n = f.state.images[f.state.image].filter((id) => f.state.local.includes(id)).length;
    return n === f.state.images[f.state.image].length
      ? ["Every layer is already here", "Nothing to download. The digests in the manifest match layers on disk."]
      : ["Checks which layers it already has", `${n} of ${f.state.images[f.state.image].length} are on disk. Only the rest are downloaded: a layer with the same digest is the same bytes.`];
  },
  "layer.pulling": (f) => [`Requests layer ${f.layer}`, `Made by “${LAYERS[f.layer ?? ""]?.step}” in the Dockerfile.`],
  "layer.pulled": (f) => [`Layer ${f.layer} downloaded`, `${LAYERS[f.layer ?? ""]?.mb} MB, unpacked into the layer store. ${took(f)}.`],
  "image.tagged": (f) => ["The image is complete", `${f.state.image} now exists locally. The next run won't download anything.`],
  "fs.mounted": (f) => ["A filesystem is assembled", `overlayfs stacks the read-only layers and adds a thin writable layer for ${f.container}.${f.state.useVolume ? " The named volume is mounted at /app/data, outside that layer." : ""}`],
  "runtime.create": (f) => ["The runtime takes over", `containerd prepares ${f.container}, and runc does the system calls.`],
  "kernel.namespaces": () => ["New namespaces", "The process gets its own view of process IDs, mounts, network and hostname. It can't see the host's processes."],
  "kernel.cgroup": (f) => ["A cgroup sets the limits", `Memory capped at ${f.state.containers.find((c) => c.id === f.container)?.memoryLimit} MB. The kernel enforces it, not Docker.`],
  "process.started": (f) => {
    const c = f.state.containers.find((x) => x.id === f.container);
    return ["The process starts", `Inside the container it's PID 1. The host sees an ordinary process, PID ${c?.pid}. There's no VM and no second kernel.`];
  },
  "run.done": (f) => ["Running", `${f.container} is up. The whole command took ${f.state.elapsed} ms (illustrative), ${f.state.elapsed > 400 ? "most of it downloading" : "with nothing to download"}.`],
  "exec.requested": (f) => ["Runs a command inside", `docker exec starts another process in ${f.container}'s namespaces and writes ${f.file}.`],
  "file.written": (f) => {
    const c = f.state.containers.find((x) => x.id === f.container);
    return c?.volume
      ? ["Written to the volume", `${f.file} lives in the named volume, which belongs to no container.`]
      : ["Written to the writable layer", `${f.file} exists only in ${f.container}'s own layer. The image underneath is unchanged.`];
  },
  "memory.grew": () => ["The process asks for memory", `It tries to allocate ${ALLOCATE_MB} MB.`],
  "memory.ok": (f) => ["Within the limit", `${ALLOCATE_MB} MB fits under ${f.state.containers.find((c) => c.id === f.container)?.memoryLimit} MB, so the kernel grants it.`],
  "oom.killed": (f) => ["Killed by the kernel", `Over the cgroup's limit, the kernel's OOM killer sends SIGKILL. ${f.container} exits with code 137 (128 + signal 9).`],
  "container.restarted": (f) => ["Restarted by policy", `--restart always: the daemon starts ${f.container} again with a new process. Files in its writable layer survive, because it's the same container.`],
  "rm.requested": (f) => ["The container is removed", `docker rm -f stops ${f.container}'s process first if it's still running.`],
  "container.removed": (f) => ["Its writable layer is deleted", `Anything ${f.container} wrote outside a volume is gone. The image's layers stay, ready for the next run.`],
  "images.pruned": () => ["Unused images removed", "Layers no container needs are deleted. The next run of those images downloads them again."],
  "config.changed": (f) => configNote(f),
};

const configNote = ({ patch = {} }: DockerFrame): Note => {
  if (patch.image) return [`Image: ${patch.image}`, "The next run uses this tag."];
  if (patch.memoryLimit) return [`Memory limit: ${patch.memoryLimit} MB`, "Applies to containers started from now on."];
  if (patch.useVolume !== undefined) return [patch.useVolume ? "Volume on" : "Volume off", patch.useVolume ? "New containers mount the named volume at /app/data." : "New containers keep everything in their writable layer."];
  return [`Restart policy: ${patch.restart}`, "Applies to containers started from now on."];
};

export const describe = (frame: DockerFrame): Note => NOTES[frame.type](frame);

export const DOCKERFILE = [
  "FROM node:22-slim",
  "WORKDIR /app",
  "COPY package*.json ./",
  "RUN npm ci --omit=dev",
  "COPY . .",
  'CMD ["node", "server.js"]',
];

// `docker ps -a`, from live simulation state.
export const psTable = (f: DockerFrame) => {
  const pad = (v: string | number, n: number) => String(v).padEnd(n);
  const head = `${pad("CONTAINER", 11)}${pad("IMAGE", 10)}${pad("STATUS", 20)}${pad("HOST PID", 10)}MEM`;
  const rows = f.state.containers.map((c) => {
    const status = c.status === "running" ? `Up${c.restarts ? ` (${c.restarts} restart)` : ""}` : `Exited (${c.exitCode ?? 0})`;
    return `${pad(c.id, 11)}${pad(c.image, 10)}${pad(status, 20)}${pad(c.status === "running" ? c.pid : "-", 10)}${c.memoryLimit}M`;
  });
  return { head, rows };
};
