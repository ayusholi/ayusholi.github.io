import * as engine from "./reminders-engine";
import type { MessageId, RemAction, RemConfig, RemFrame, RemState } from "./reminders-types";

// The named moves a visitor or scenario can make.
export const ACTIONS = {
  send: (message: MessageId): RemAction => (s) => engine.send(s, message),
  advance: (): RemAction => engine.advance,
};

type Scenario = {
  label: string;
  title: string;
  lesson: string;
  options: RemConfig;
  play: RemAction[];
};

export const SCENARIOS = {
  one: {
    label: "A", title: "Remind me",
    lesson: "A WhatsApp message reaches your server as a webhook. One model call turns the sentence into a task and a time, and that becomes a row in a table. Hours later, plain code sends it: no AI at the moment it matters.",
    options: {}, play: [ACTIONS.send("rent"), ACTIONS.advance()],
  },
  timezone: {
    label: "B", title: "Wrong timezone",
    lesson: "Same message, but the prompt gives the model the server's clock, in UTC. It does exactly what it's told: 9am UTC. In Kathmandu that's 14:45, and the rent reminder arrives in the afternoon.",
    options: { tz: "server" }, play: [ACTIONS.send("rent"), ACTIONS.advance()],
  },
  unclear: {
    label: "C", title: "No time given",
    lesson: "“Later” isn't a time. The schema allows at: null, so the model can say it doesn't know instead of inventing 5pm, and the bot asks. One extra message beats a reminder at a time the user never chose.",
    options: {}, play: [ACTIONS.send("later")],
  },
  daytwo: {
    label: "D", title: "Day two",
    lesson: "A daily reminder works on Monday evening. By 20:00 on Tuesday the user hasn't written for 25½ hours, the 24-hour window has closed, and WhatsApp refuses the free-form message. The user just stops getting reminders.",
    options: { template: "off" }, play: [ACTIONS.send("pills"), ACTIONS.advance(), ACTIONS.advance()],
  },
  template: {
    label: "E", title: "Template",
    lesson: "The same two days with an approved template for messages outside the window. Tuesday's reminder goes out as the template, with the task filled in. Still one AI call: the schedule repeats, the model doesn't.",
    options: { template: "on" }, play: [ACTIONS.send("pills"), ACTIONS.advance(), ACTIONS.advance()],
  },
} satisfies Record<string, Scenario>;

export type ScenarioId = keyof typeof SCENARIOS;

export const readyFrame = (state: RemState): RemFrame => ({ type: "ready", state, packets: [], dur: 1 });

export const baseline = (options: RemConfig = {}) => engine.createState(options);

export const buildScenario = (id: ScenarioId) => {
  const sc: Scenario = SCENARIOS[id];
  const state = baseline(sc.options);
  return { state, frames: engine.runAll(state, ...sc.play).frames };
};
