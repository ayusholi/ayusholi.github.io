"use client";

import { Challenge } from "@/components/ui/Challenge";
import { reducedMotion, useTimelineFrame } from "@/lib/simulation/useTimeline";
import { useNginx } from "./NginxProvider";
import { config, configLine } from "./nginx-content";
import { createState, runAll, THREADS } from "./nginx-engine";
import { ACTIONS } from "./nginx-scenarios";

const watch = (run: () => void) => () => {
  run();
  document.getElementById("bench")?.scrollIntoView({ behavior: reducedMotion() ? "auto" : "smooth" });
};

const n = (v: number) => v.toLocaleString("en");

// The config follows the simulation: the directive at work now is lit.
export const NginxConfigPanel = () => {
  const { timeline } = useNginx();
  const frame = useTimelineFrame(timeline);
  const line = configLine(frame);
  return (
    <pre className="code" id="config" tabIndex={0} aria-label="nginx.conf. The highlighted line follows the simulation.">
      <code>{config(frame.state).map((text, i) => <span key={i} className={`ln${i === line ? " is-now" : ""}`}>{text}</span>)}</code>
    </pre>
  );
};

// What the server would report about its connections right now.
export const NginxStatus = () => {
  const { timeline } = useNginx();
  const { state: s } = useTimelineFrame(timeline);
  const running = s.requests[s.requests.length - 1]?.status === "running" ? 1 : 0;
  const text = s.model === "event"
    ? [
      "$ curl -s localhost/nginx_status",
      `Active connections: ${n(s.stats.connections + running)}`,
      "server accepts handled requests",
      ` ${n(s.idle + s.stats.requests)} ${n(s.idle + s.stats.requests)} ${n(s.stats.requests)}`,
      `Reading: 0 Writing: ${running} Waiting: ${n(s.stats.connections)}`,
    ]
    : [
      "$ server-status",
      `Threads busy: ${n(Math.min(THREADS, s.stats.connections + running))} of ${THREADS}`,
      `Connections queued: ${n(s.stats.waiting)}`,
      `Memory: ${n(s.stats.memoryMb)} MB`,
    ];
  return (
    <pre className="cli" id="status-panel" tabIndex={0} aria-label="The server's connection status">
      <span className="dim">{text[0]}</span>{`\n${text.slice(1).join("\n")}`}
    </pre>
  );
};

// Answers are computed by running the question through the engine.
export const NginxChallenges = () => {
  const { runScenario } = useNginx();
  return (
    <>
      <Challenge
        id="challenge"
        question="10,000 clients hold idle keep-alive connections. A server that gives each connection its own thread has a pool of 400. What happens to the next real request?"
        options={["It's served, a little slower than usual.", "It waits for a free thread, and times out.", "The server adds threads until it runs out of memory, then serves it."]}
        answer={1}
        verdict={() => {
          const t = runAll(createState({ model: "threads" }), ACTIONS.burst(), ACTIONS.request("page")).state;
          const e = runAll(createState({ model: "event" }), ACTIONS.burst(), ACTIONS.request("page")).state;
          return `The simulation records ${t.stats.errors} timeout: every thread is parked on a client that isn't sending anything, with ${n(t.stats.waiting)} more in line. Nginx's event loop holds the same ${n(e.stats.connections)} connections in about ${n(e.stats.memoryMb)} MB and serves the request with ${e.stats.errors} errors. Idle connections are cheap only if they don't each need a thread.`;
        }}
        watch={{ label: "Watch it happen ↑", run: watch(() => runScenario("threads")) }}
      />
      <Challenge
        id="challenge-2"
        className="mt-11"
        question="app2 has crashed, and nginx doesn't know yet. Round robin sends the next request to app2. What does the visitor get?"
        options={["A 502 error page.", "The page, served by another app server a moment later.", "A request that hangs until app2 comes back."]}
        answer={1}
        verdict={() => {
          const s = runAll(createState(), ACTIONS.toggle("app2"), ACTIONS.request("page"), ACTIONS.request("page")).state;
          const all = runAll(createState(), ...(["app1", "app2", "app3"] as const).map(ACTIONS.toggle), ACTIONS.request("page")).state;
          return `The connection is refused at once, so proxy_next_upstream retries on the next server: the simulation shows ${s.stats.retries} retry and ${s.stats.errors} errors. app2 is then marked down and skipped. A 502 only comes when there's nobody left: with all three down, ${all.stats.errors} request fails.`;
        }}
        watch={{ label: "Watch it happen ↑", run: watch(() => runScenario("down")) }}
      />
    </>
  );
};
