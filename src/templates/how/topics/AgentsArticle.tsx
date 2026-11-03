import { notFound } from "next/navigation";
import { Section } from "@/components/layout/Section";
import { PageContainer } from "@/components/layout/PageContainer";
import { TopicHeader } from "@/components/topics/TopicHeader";
import { getTopic } from "@/lib/content";
import { AgentsBench } from "@/features/agents/AgentsBench";
import { AgentsChallenges, AgentsOutbox, AgentsTools } from "@/features/agents/AgentsLivePanels";
import { AgentsProvider } from "@/features/agents/AgentsProvider";

// Prose renders on the server. The live panels between it are small client
// components sharing one simulation through AgentsProvider.
export default async function AgentsArticle() {
  const topic = await getTopic("ai-agents");
  if (!topic) notFound();
  return (
    <AgentsProvider>
      <TopicHeader
        topic={topic}
        mechanism={8}
        headline="What happens when a language model is allowed to take actions?"
        lede="It still only writes text. Some of that text is a request to run a tool, and ordinary code around the model decides whether to run it. An agent is that loop, repeated until the model stops asking."
        note="The model's choices are a fixed policy over its transcript. Tokens are estimated at four characters each."
      />

      <PageContainer aria-label="AI agent simulation">
        <AgentsBench />
        <noscript><p className="prose">This simulation needs JavaScript. The explanations below still work without it.</p></noscript>
      </PageContainer>

      <Section id="ideas" label="The model" title="Three ideas explain most of it">
        <div className="breaks">
          <article className="break">
            <span className="label">Idea 1 · tool calls</span>
            <h3>The model asks, the runtime acts</h3>
            <p>The model is shown a list of tools with names and arguments. To use one it replies with a structured call. Running it, with real permissions, is the runtime&apos;s job.</p>
          </article>
          <article className="break">
            <span className="label">Idea 2 · the loop</span>
            <h3>Results go back in, and it goes again</h3>
            <p>Each tool result is appended to the transcript and the model is called again. It plans one step at a time, from whatever the last result said.</p>
          </article>
          <article className="break">
            <span className="label">Idea 3 · the harness</span>
            <h3>Safety is code around the model</h3>
            <p>Step budgets, approvals, allow-lists and timeouts all live in the runtime. They hold however the model is persuaded, because they never ask its opinion.</p>
          </article>
        </div>
      </Section>

      <Section id="hood" label="Under the hood" title="A tool is a description and a function">
        <div className="split">
          <div>
            <p className="readout__h label"><span>Live: the tool in use now</span></p>
            <AgentsTools />
            <p className="readout__h label mt-5"><span>Live: what the agent has sent</span></p>
            <AgentsOutbox />
          </div>
          <div className="prose">
            <p>The model never sees code. It sees a name, a sentence about what the tool does and a schema for its arguments, and it learned in training to reply with a call in the right shape when one would help.</p>
            <p>Protocols like MCP standardise how tools are described and connected, so one runtime can use tools written by anyone. The loop stays the same.</p>
            <p>Look at the transcript as the agent runs: every message, tool results included, is sent again on every call. That&apos;s the agent&apos;s memory, and also why long runs get slow and expensive.</p>
          </div>
        </div>
      </Section>

      <Section id="breaks" label="When it breaks" title="Text in, actions out">
        <div className="breaks">
          <article className="break">
            <span className="label">Scenario D · prompt injection</span>
            <h3>Data that reads like an order</h3>
            <p>A web page, an email or a document can contain text aimed at the model. In the context it looks like any other instruction. Gate the tools that can do harm.</p>
          </article>
          <article className="break">
            <span className="label">Scenario E · runaway loop</span>
            <h3>No stopping condition</h3>
            <p>A vague goal can never be met, so the model keeps trying. Without a step or cost budget the loop runs until something external stops it.</p>
          </article>
          <article className="break">
            <span className="label">The quiet failure</span>
            <h3>Errors swallowed as results</h3>
            <p>A failed tool returns an error message, and the model may retry, give up or carry on as if it worked. Break the weather API and watch which it does.</p>
          </article>
        </div>
      </Section>

      <Section id="test" label="Test yourself" title="Two predictions">
        <AgentsChallenges />
      </Section>

      <Section id="simplified" label="Fine print" title="What this model leaves out">
        <div className="notes">
          <details>
            <summary>A real model&apos;s choices</summary>
            <div><p>Here the model follows a fixed policy over its transcript, so every run is repeatable. A real model makes the same kind of decision by generating text, and can choose differently on different runs.</p></div>
          </details>
          <details>
            <summary>Parallel calls and planning</summary>
            <div><p>Real models can request several tools at once, and some agents write a plan first and work through it. Both are still this loop with more in each turn.</p></div>
          </details>
          <details>
            <summary>Context management</summary>
            <div><p>Long-running agents can&apos;t resend everything forever. They summarise old turns, drop bulky tool results, or keep notes in a file they read back with a tool.</p></div>
          </details>
          <details>
            <summary>Multi-agent systems</summary>
            <div><p>One agent can call another as a tool, handing it a sub-task and reading back its answer. Each one is still a model in a loop, with its own transcript and its own guardrails.</p></div>
          </details>
        </div>
      </Section>
    </AgentsProvider>
  );
}
