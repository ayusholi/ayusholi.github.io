import { notFound } from "next/navigation";
import { Section } from "@/components/layout/Section";
import { PageContainer } from "@/components/layout/PageContainer";
import { TopicHeader } from "@/components/topics/TopicHeader";
import { getTopic } from "@/lib/content";
import { AutomationsBench } from "@/features/automations/AutomationsBench";
import { AutomationsChallenges, AutomationsItem, AutomationsWorkflow } from "@/features/automations/AutomationsLivePanels";
import { AutomationsProvider } from "@/features/automations/AutomationsProvider";

// Prose renders on the server. The live panels between it are small client
// components sharing one simulation through AutomationsProvider.
export default async function AutomationsArticle() {
  const topic = await getTopic("ai-automations");
  if (!topic) notFound();
  return (
    <AutomationsProvider>
      <TopicHeader
        topic={topic}
        mechanism={10}
        headline="How does a workflow turn an email into an action without anyone reading it?"
        lede="A trigger starts it, a JSON item moves from node to node, and one node asks a model to turn free text into fields. Everything after that is ordinary branching. Tools like n8n and Flowise draw exactly this."
        note="One fixed workflow, one email per execution. The AI's replies are fixed per email so every run is repeatable."
      />

      <PageContainer aria-label="AI automation simulation">
        <AutomationsBench />
        <noscript><p className="prose">This simulation needs JavaScript. The explanations below still work without it.</p></noscript>
      </PageContainer>

      <Section id="ideas" label="The model" title="Three ideas explain most of it">
        <div className="breaks">
          <article className="break">
            <span className="label">Idea 1 · executions</span>
            <h3>A trigger starts a run</h3>
            <p>A new email, a webhook, a schedule or a form starts one execution. It carries an item, plain JSON, that each node reads, adds to and passes on.</p>
          </article>
          <article className="break">
            <span className="label">Idea 2 · the AI node</span>
            <h3>Free text in, fields out</h3>
            <p>The model&apos;s job is narrow: read something messy and return named fields in a fixed schema. That turns language into data a switch can route on.</p>
          </article>
          <article className="break">
            <span className="label">Idea 3 · plain logic</span>
            <h3>Decisions stay readable</h3>
            <p>What each category does is a branch someone drew and anyone can read. Unlike an agent, the model never picks the next step: the workflow does.</p>
          </article>
        </div>
      </Section>

      <Section id="hood" label="Under the hood" title="Everything is an item moving between nodes">
        <div className="split">
          <div>
            <p className="readout__h label"><span>Live: the node running now</span></p>
            <AutomationsWorkflow />
            <p className="readout__h label mt-5"><span>Live: the item as JSON</span></p>
            <AutomationsItem />
          </div>
          <div className="prose">
            <p>n8n is a general automation tool: hundreds of integrations, with AI as one kind of node among many. Flowise starts from the other end, a visual builder for LLM chains, agents and RAG flows, often called from another system. Underneath, both are this: nodes joined by wires, with data flowing along them.</p>
            <p>Watch the item. The trigger adds the email&apos;s fields, the AI node adds <code>category</code>, <code>orderId</code> and <code>urgent</code>, and later nodes refer to them with expressions like <code>{"{{ $json.orderId }}"}</code>.</p>
            <p>Nodes that write, such as a sheet or a reply, are side effects. A workflow is only as reliable as its handling of the run that fails halfway, and of the one that runs twice.</p>
          </div>
        </div>
      </Section>

      <Section id="breaks" label="When it breaks" title="The AI step is the unreliable one">
        <div className="breaks">
          <article className="break">
            <span className="label">Scenario C · bad output</span>
            <h3>Chatty instead of JSON</h3>
            <p>Models sometimes add a friendly sentence or stop mid-object. Ask for a schema, parse strictly, and decide in advance what a failure does.</p>
          </article>
          <article className="break">
            <span className="label">Scenario E · fired twice</span>
            <h3>Duplicates become side effects</h3>
            <p>Polling windows overlap and webhooks are retried. Without a check on the message id, one email becomes two rows and two replies.</p>
          </article>
          <article className="break">
            <span className="label">The quiet failure</span>
            <h3>Failures nobody watches</h3>
            <p>A failed execution is logged and then forgotten. Give the workflow an error branch that tells a person, or failures turn into customers who were silently ignored.</p>
          </article>
        </div>
      </Section>

      <Section id="test" label="Test yourself" title="Two predictions">
        <AutomationsChallenges />
      </Section>

      <Section id="simplified" label="Fine print" title="What this model leaves out">
        <div className="notes">
          <details>
            <summary>Many items per execution</summary>
            <div><p>In n8n a node can receive many items at once, for example every new email since the last poll, and runs once per item. Here each execution carries one, to keep the path readable.</p></div>
          </details>
          <details>
            <summary>Agent nodes</summary>
            <div><p>Both tools also have agent nodes, where the model chooses tools in a loop. That trades the readable branches here for flexibility, with the risks the AI agents topic shows.</p></div>
          </details>
          <details>
            <summary>Credentials and rate limits</summary>
            <div><p>Each integration needs credentials, stored by the tool and scoped as tightly as possible. Real AI and email APIs also have rate limits, so busy workflows queue, batch or back off.</p></div>
          </details>
          <details>
            <summary>Human review</summary>
            <div><p>A common middle ground is drafting instead of sending: the workflow writes the reply, and a person approves it with one click. It keeps most of the time saved and removes most of the risk.</p></div>
          </details>
        </div>
      </Section>
    </AutomationsProvider>
  );
}
