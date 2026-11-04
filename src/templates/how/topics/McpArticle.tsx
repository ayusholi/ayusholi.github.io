import { notFound } from "next/navigation";
import { Section } from "@/components/layout/Section";
import { PageContainer } from "@/components/layout/PageContainer";
import { TopicHeader } from "@/components/topics/TopicHeader";
import { getTopic } from "@/lib/content";
import { McpBench } from "@/features/mcp/McpBench";
import { McpChallenges, McpChat, McpMessage, McpToolPrompt } from "@/features/mcp/McpLivePanels";
import { McpProvider } from "@/features/mcp/McpProvider";

// Prose renders on the server. The live panels between it are small client
// components sharing one simulation through McpProvider.
export default async function McpArticle() {
  const topic = await getTopic("mcp");
  if (!topic) notFound();
  return (
    <McpProvider>
      <TopicHeader
        topic={topic}
        mechanism={14}
        headline="How does an AI app plug into tools it has never seen before?"
        lede="The Model Context Protocol is a standard way for an AI app to ask a server what it can do, and then to ask it to do it. The model chooses; the app makes the calls; the server does the work."
        note="Two small servers and four tools. Messages follow the MCP specification (JSON-RPC 2.0, version 2025-06-18); the model's choices are fixed per question so every run is repeatable."
      />

      <PageContainer aria-label="MCP simulation">
        <McpBench />
        <noscript><p className="prose">This simulation needs JavaScript. The explanations below still work without it.</p></noscript>
      </PageContainer>

      <Section id="ideas" label="The model" title="Three ideas explain most of it">
        <div className="breaks">
          <article className="break">
            <span className="label">Idea 1 · discovery</span>
            <h3>Servers describe themselves</h3>
            <p>After a short handshake, <code>tools/list</code> returns each tool&apos;s name, description and input schema. Nothing is hard-coded in the app: connect a new server and its tools simply appear.</p>
          </article>
          <article className="break">
            <span className="label">Idea 2 · roles</span>
            <h3>The model never connects</h3>
            <p>The model only reads tool descriptions and asks for a call. The host holds the connections, sends <code>tools/call</code> and returns the result. That&apos;s where permissions belong.</p>
          </article>
          <article className="break">
            <span className="label">Idea 3 · one protocol</span>
            <h3>Build once, use anywhere</h3>
            <p>A server written once works in any MCP host: chat apps, IDEs, agents. Without a standard, every app had to write its own integration for every tool.</p>
          </article>
        </div>
      </Section>

      <Section id="hood" label="Under the hood" title="Just JSON-RPC, over a pipe">
        <div className="split">
          <div>
            <p className="readout__h label"><span>Live: the latest message on the wire</span></p>
            <McpMessage />
            <p className="readout__h label mt-5"><span>Live: the tools the model is shown</span></p>
            <McpToolPrompt />
            <p className="readout__h label mt-5"><span>Live: the conversation, with tool results</span></p>
            <McpChat />
          </div>
          <div className="prose">
            <p>Every MCP message is a JSON-RPC 2.0 object. Requests have an <code>id</code> and a <code>method</code>, and their reply carries the same <code>id</code>. Notifications, like <code>notifications/initialized</code>, have no id and get no reply.</p>
            <p>Two transports carry them. With <strong>stdio</strong>, the host starts the server as a child process and writes to its stdin, which is how most local servers run. With <strong>Streamable HTTP</strong>, the server runs somewhere else and the client POSTs to one endpoint, with authorization on top.</p>
            <p>Tools are one of three things a server can offer. <em>Resources</em> are data the app can read into context, like a file or a database row, and <em>prompts</em> are reusable templates the user can pick. The handshake&apos;s <code>capabilities</code> say which ones a server supports.</p>
          </div>
        </div>
      </Section>

      <Section id="breaks" label="When it breaks" title="The risks come with the reach">
        <div className="breaks">
          <article className="break">
            <span className="label">Scenario D · tool error</span>
            <h3>Errors the model can read</h3>
            <p>A tool that fails should say so in its result, with <code>isError: true</code> and a useful message. The model can then try something else. A server that crashes or hangs leaves it nothing to work with.</p>
          </article>
          <article className="break">
            <span className="label">Scenario E · approval</span>
            <h3>Writes need a person</h3>
            <p>The protocol can mark a tool as read-only or destructive, but it&apos;s the host that decides whether to ask. An app that allows every call lets the model book, send and delete on a guess.</p>
          </article>
          <article className="break">
            <span className="label">Trusting servers</span>
            <h3>Descriptions are prompts too</h3>
            <p>A tool&apos;s description goes straight into the model&apos;s prompt. A malicious server can hide instructions there, and a local stdio server runs with your permissions. Install servers like you install software.</p>
          </article>
        </div>
      </Section>

      <Section id="test" label="Test yourself" title="Two predictions">
        <McpChallenges />
      </Section>

      <Section id="simplified" label="Fine print" title="What this model leaves out">
        <div className="notes">
          <details>
            <summary>Choosing tools</summary>
            <div><p>Here the model&apos;s choices are scripted. A real model picks from the descriptions it&apos;s given, so vague names and descriptions lead to wrong or missed calls. Writing them well is most of the work of building a server.</p></div>
          </details>
          <details>
            <summary>Many tools at once</summary>
            <div><p>Every tool definition takes up space in the prompt. With dozens of servers that adds up, so hosts let users switch servers off, or load tool definitions only when they&apos;re needed.</p></div>
          </details>
          <details>
            <summary>Servers that talk back</summary>
            <div><p>Servers can send notifications too, such as <code>notifications/tools/list_changed</code> when their tools change. They can also ask the host for things, like asking its model for a completion (sampling) or asking the user for input.</p></div>
          </details>
          <details>
            <summary>Authorization</summary>
            <div><p>Remote servers use OAuth so a user can grant an app access to their account without handing over a password. Local stdio servers usually read credentials from environment variables the host passes in.</p></div>
          </details>
        </div>
      </Section>
    </McpProvider>
  );
}
