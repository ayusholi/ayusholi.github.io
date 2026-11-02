import * as engine from "./docker-engine";
import type { DockerAction, DockerConfig, DockerFrame, DockerState, ImageTag } from "./docker-types";

// The named moves a visitor or scenario can make.
export const ACTIONS = {
  run: (): DockerAction => engine.run,
  runImage: (image: ImageTag): DockerAction => (s) => engine.run({ ...s, image }),
  write: (): DockerAction => engine.writeFile,
  spike: (): DockerAction => engine.spikeMemory,
  remove: (): DockerAction => engine.remove,
  prune: (): DockerAction => engine.prune,
};

type Scenario = {
  label: string;
  title: string;
  lesson: string;
  options: DockerConfig;
  setup: DockerAction[];   // runs off-screen
  play: DockerAction[];    // what you watch
};

export const SCENARIOS = {
  cold: {
    label: "A", title: "First run",
    lesson: "Nothing is on this machine yet. Before anything can start, the daemon downloads every layer of the image. Then starting the container itself is quick.",
    options: {}, setup: [], play: [ACTIONS.run()],
  },
  warm: {
    label: "B", title: "Cached",
    lesson: "The same image again. Every layer is already on disk, so nothing is downloaded and the run takes a fraction of the time.",
    options: {}, setup: [ACTIONS.run(), ACTIONS.remove()], play: [ACTIONS.run()],
  },
  update: {
    label: "C", title: "New version",
    lesson: "web:1.1 changes only application code. Its first two layers have the same digests as 1.0's, so only the small top layer is downloaded. Then try web:1.2, which changes package.json.",
    options: {}, setup: [ACTIONS.runImage("web:1.0"), ACTIONS.remove()], play: [ACTIONS.runImage("web:1.1")],
  },
  limit: {
    label: "D", title: "Memory limit",
    lesson: "A container is a process the kernel holds to a cgroup limit. This one asks for 300 MB with 128 MB allowed, and the kernel kills it. Set the restart policy to “always” and try again.",
    options: { memoryLimit: 128 }, setup: [ACTIONS.run()], play: [ACTIONS.spike()],
  },
  ephemeral: {
    label: "E", title: "Lost files",
    lesson: "A file written inside a container lives in that container's writable layer. Remove the container, run the image again, and the file is gone. Switch the volume on and repeat.",
    options: {}, setup: [ACTIONS.run(), ACTIONS.write()], play: [ACTIONS.remove(), ACTIONS.run()],
  },
} satisfies Record<string, Scenario>;

export type ScenarioId = keyof typeof SCENARIOS;

export const readyFrame = (state: DockerState): DockerFrame => ({ type: "ready", state, packets: [], dur: 1 });

export const buildScenario = (id: ScenarioId) => {
  const sc: Scenario = SCENARIOS[id];
  const { state } = engine.runAll(engine.createState(sc.options), ...sc.setup);
  return { state, frames: engine.runAll(state, ...sc.play).frames };
};
