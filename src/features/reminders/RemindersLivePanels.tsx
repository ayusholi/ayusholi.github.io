"use client";

import { Challenge } from "@/components/ui/Challenge";
import { reducedMotion, useTimelineFrame } from "@/lib/simulation/useTimeline";
import { useReminders } from "./RemindersProvider";
import { apiCall, windowLine } from "./reminders-content";
import { clock, createState, promptClock, runAll, when } from "./reminders-engine";
import { ACTIONS } from "./reminders-scenarios";

const watch = (run: () => void) => () => {
  run();
  document.getElementById("bench")?.scrollIntoView({ behavior: reducedMotion() ? "auto" : "smooth" });
};

// The conversation as the user sees it, plus what they don't see.
export const RemindersChat = () => {
  const { timeline } = useReminders();
  const { state } = useTimelineFrame(timeline);
  const lines = state.chat.length
    ? state.chat.map((l) => `[${when(l.at)}] ${l.from === "you" ? "You" : "Bot"}: ${l.text}${l.template ? "  (template)" : ""}${l.failed ? "  ✕ never arrived" : ""}`)
    : ["(no messages yet)"];
  return (
    <pre className="cli" id="chat" tabIndex={0} aria-label="The chat, oldest first">
      <span className="dim">{windowLine(state)}</span>{`\n${lines.join("\n")}`}
    </pre>
  );
};

// The one model call: what it was told, and what it returned.
export const RemindersParsed = () => {
  const { timeline } = useReminders();
  const { state } = useTimelineFrame(timeline);
  return (
    <pre className="cli" id="parsed" tabIndex={0} aria-label="The model's input and structured output">
      <span className="dim">{`$ prompt: ${promptClock(state)}`}</span>
      {`\n${state.parsed ? JSON.stringify(state.parsed, null, 2) : "(no model call yet)"}`}
    </pre>
  );
};

// The latest outgoing API call, and how it ended.
export const RemindersApi = () => {
  const { timeline } = useReminders();
  const { state } = useTimelineFrame(timeline);
  const [head, ...rest] = apiCall(state);
  return (
    <pre className="cli" id="api" tabIndex={0} aria-label="The latest call to the WhatsApp API">
      <span className="dim">{head}</span>{rest.length ? `\n${rest.join("\n")}` : ""}
    </pre>
  );
};

// Answers are computed by running the question through the engine.
export const RemindersChallenges = () => {
  const { runScenario } = useReminders();
  return (
    <>
      <Challenge
        id="challenge"
        question="A user in Kathmandu asks for a reminder “tomorrow at 9am”. The prompt tells the model the current time in UTC. When does the reminder arrive?"
        options={["09:00, because the model knows Nepal from the phone number.", "14:45: the model reads 9am as 9am UTC.", "It fails, because the times don't match."]}
        answer={1}
        verdict={() => {
          const r = runAll(createState({ tz: "server" }), ACTIONS.send("rent")).state.reminders[0];
          return `The simulation saves it for ${r ? when(r.due) : "?"}: 9am UTC is ${r ? clock(r.due) : "?"} at UTC+5:45. The model never sees the user's timezone unless the prompt includes it. Store each user's zone, put it in the prompt, and save due times with an explicit offset.`;
        }}
        watch={{ label: "Watch it happen ↑", run: watch(() => runScenario("timezone")) }}
      />
      <Challenge
        id="challenge-2"
        className="mt-11"
        question="A daily 8pm reminder is set at 18:30 on Monday, and the user doesn't write again. Without a message template, what happens on Tuesday at 8pm?"
        options={["It arrives, the same as Monday's.", "WhatsApp refuses it: the 24-hour window has closed.", "The AI is asked again and rewrites it."]}
        answer={1}
        verdict={() => {
          const off = runAll(createState({ template: "off" }), ACTIONS.send("pills"), ACTIONS.advance(), ACTIONS.advance()).state;
          const on = runAll(createState({ template: "on" }), ACTIONS.send("pills"), ACTIONS.advance(), ACTIONS.advance()).state;
          return `Without a template, ${off.stats.delivered} reminder is delivered and ${off.stats.rejected} is refused: 25½ hours have passed since the user's last message. With an approved template, ${on.stats.delivered} are delivered. Either way, it's ${on.stats.aiCalls} AI call: repeating is the scheduler's job.`;
        }}
        watch={{ label: "Watch it happen ↑", run: watch(() => runScenario("daytwo")) }}
      />
    </>
  );
};
