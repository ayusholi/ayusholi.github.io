"use client";

import { Challenge } from "@/components/ui/Challenge";
import { reducedMotion, useTimelineFrame } from "@/lib/simulation/useTimeline";
import { useDocker } from "./DockerProvider";
import { DOCKERFILE, psTable } from "./docker-content";
import { createState, LAYERS, runAll } from "./docker-engine";
import { ACTIONS } from "./docker-scenarios";

// The Dockerfile follows the simulation: the line that made the layer in play is lit.
export const DockerfilePanel = () => {
  const { timeline } = useDocker();
  const frame = useTimelineFrame(timeline);
  const line = frame.layer ? LAYERS[frame.layer]?.line : undefined;
  return (
    <pre className="code" id="dockerfile" tabIndex={0} aria-label="Dockerfile. The highlighted line made the layer the simulation is handling.">
      <code>{DOCKERFILE.map((text, i) => <span key={i} className={`ln${i + 1 === line || (line === 4 && i === 2) ? " is-now" : ""}`}>{text}</span>)}</code>
    </pre>
  );
};

export const DockerTerminal = () => {
  const { timeline } = useDocker();
  const frame = useTimelineFrame(timeline);
  const { head, rows } = psTable(frame);
  return (
    <pre className="cli" id="terminal" tabIndex={0} aria-label="Terminal output and container list">
      {frame.state.log.length ? frame.state.log.join("\n") : <span className="dim">(nothing run yet)</span>}
      {"\n\n"}<span className="dim">$ docker ps -a</span>{`\n${head}${rows.length ? `\n${rows.join("\n")}` : ""}`}
    </pre>
  );
};

// Answers are computed by running the question through the engine.
export const DockerChallenges = () => {
  const { runScenario } = useDocker();
  return (
    <>
      <Challenge
        id="challenge"
        question="A server already runs web:1.0. You change one line of server.js, build web:1.1 and run it there. How much does the server download?"
        options={["The whole image again, about 117 MB.", "Only the layer that holds the code, about 2 MB.", "Nothing. Docker sends a diff of the file."]}
        answer={1}
        verdict={() => {
          const { state } = runAll(createState(), ACTIONS.runImage("web:1.0"), ACTIONS.runImage("web:1.1"));
          return `In the simulation the server downloads ${state.stats.downloadedMb - 117} MB for web:1.1 and reuses ${state.stats.reusedLayers} layers. Layers are addressed by a hash of their content, so the base image and node_modules are recognised as already present. Docker never diffs files: a changed layer is downloaded whole.`;
        }}
        watch={{
          label: "Watch it happen ↑",
          run: () => {
            runScenario("update");
            document.getElementById("bench")?.scrollIntoView({ behavior: reducedMotion() ? "auto" : "smooth" });
          },
        }}
      />
      <Challenge
        id="challenge-2"
        className="mt-11"
        question="Now the Dockerfile is reordered: COPY . . comes before RUN npm ci. Every code change still edits only server.js. What happens to the npm ci layer?"
        options={["Nothing. It's cached as before.", "It's rebuilt and downloaded on every code change.", "Docker moves the instruction back automatically."]}
        answer={1}
        verdict={() => "A layer is only reused if everything below it is identical. With the code copied first, any code change makes every later layer new, including the large one with node_modules. That's why Dockerfiles copy package.json and install dependencies before copying the rest of the code: web:1.2 in the simulation changes package.json and pays for both layers."}
      />
    </>
  );
};
