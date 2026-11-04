import * as engine from "./nginx-engine";
import type { NginxAction, NginxConfig, NginxFrame, NginxState, RequestKind, Upstream } from "./nginx-types";

// The named moves a visitor or scenario can make.
export const ACTIONS = {
  request: (kind: RequestKind): NginxAction => (s) => engine.request(s, kind),
  burst: (): NginxAction => engine.burst,
  toggle: (id: Upstream): NginxAction => (s) => engine.toggle(s, id),
};

type Scenario = {
  label: string;
  title: string;
  lesson: string;
  options: NginxConfig;
  setup?: NginxAction[];
  play: NginxAction[];
};

export const SCENARIOS = {
  one: {
    label: "A", title: "One request",
    lesson: "A browser asks for /orders. Nginx doesn't build pages: it accepts the connection, picks an app server, forwards the request and relays the answer. To the browser, nginx is the server.",
    options: {}, play: [ACTIONS.request("page")],
  },
  spread: {
    label: "B", title: "Round robin",
    lesson: "Three requests go to three app servers in turn, so adding servers adds capacity. The logo never reaches an app: nginx reads it straight from disk, which is what it's fastest at.",
    options: {}, play: [ACTIONS.request("page"), ACTIONS.request("page"), ACTIONS.request("page"), ACTIONS.request("static")],
  },
  c10k: {
    label: "C", title: "10,000 idle",
    lesson: "Ten thousand clients connect and then do nothing, as phones between taps do. Nginx's workers just add them to the list they watch: about 2.5 MB in all. The next real request is served at once.",
    options: { model: "event" }, play: [ACTIONS.burst(), ACTIONS.request("page")],
  },
  threads: {
    label: "D", title: "One thread each",
    lesson: "The same crowd against a server that gives every connection its own thread. Four hundred threads are each parked on an idle client, and the next real request waits until it times out.",
    options: { model: "threads" }, play: [ACTIONS.burst(), ACTIONS.request("page")],
  },
  down: {
    label: "E", title: "App down",
    lesson: "app2 has crashed. The request sent to it is refused, nginx retries it on app3 and marks app2 down, so later requests skip it. Visitors see no errors. Crash the other two and press a request.",
    options: {}, setup: [ACTIONS.toggle("app2")], play: [ACTIONS.request("page"), ACTIONS.request("page"), ACTIONS.request("page"), ACTIONS.request("page")],
  },
} satisfies Record<string, Scenario>;

export type ScenarioId = keyof typeof SCENARIOS;

export const readyFrame = (state: NginxState): NginxFrame => ({ type: "ready", state, packets: [], dur: 1 });

export const baseline = (options: NginxConfig = {}) => engine.createState(options);

export const buildScenario = (id: ScenarioId) => {
  const sc: Scenario = SCENARIOS[id];
  const state = engine.runAll(baseline(sc.options), ...(sc.setup ?? [])).state;
  return { state, frames: engine.runAll(state, ...sc.play).frames };
};
