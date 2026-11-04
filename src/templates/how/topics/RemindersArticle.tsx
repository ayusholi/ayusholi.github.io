import { notFound } from "next/navigation";
import { Section } from "@/components/layout/Section";
import { PageContainer } from "@/components/layout/PageContainer";
import { TopicHeader } from "@/components/topics/TopicHeader";
import { getTopic } from "@/lib/content";
import { RemindersBench } from "@/features/reminders/RemindersBench";
import { RemindersApi, RemindersChallenges, RemindersChat, RemindersParsed } from "@/features/reminders/RemindersLivePanels";
import { RemindersProvider } from "@/features/reminders/RemindersProvider";

// Prose renders on the server. The live panels between it are small client
// components sharing one simulation through RemindersProvider.
export default async function RemindersArticle() {
  const topic = await getTopic("whatsapp-reminders");
  if (!topic) notFound();
  return (
    <RemindersProvider>
      <TopicHeader
        topic={topic}
        mechanism={13}
        headline="How does “remind me tomorrow at 9” become a WhatsApp message at 9?"
        lede="The AI part takes a second: one model call turns the sentence into a task and a time. Everything after that is a database row, a scheduler and the WhatsApp Business Platform's rules about when a business may message you."
        note="One user in Kathmandu (UTC+5:45). The clock skips straight to each reminder, and the model's replies are fixed per message so every run is repeatable."
      />

      <PageContainer aria-label="WhatsApp reminder bot simulation">
        <RemindersBench />
        <noscript><p className="prose">This simulation needs JavaScript. The explanations below still work without it.</p></noscript>
      </PageContainer>

      <Section id="ideas" label="The model" title="Three ideas explain most of it">
        <div className="breaks">
          <article className="break">
            <span className="label">Idea 1 · webhooks</span>
            <h3>WhatsApp calls you</h3>
            <p>You don&apos;t poll for messages. Each one arrives as an HTTP POST to your server, and you reply by calling WhatsApp&apos;s API in return. The chat is just two webhooks and an API.</p>
          </article>
          <article className="break">
            <span className="label">Idea 2 · the AI step</span>
            <h3>Words in, a time out</h3>
            <p>The model&apos;s only job is to turn &ldquo;tomorrow at 9&rdquo; into a task and an exact time, as JSON. It can only do that relative to the current time and timezone it&apos;s given.</p>
          </article>
          <article className="break">
            <span className="label">Idea 3 · plain scheduling</span>
            <h3>The reminder is just data</h3>
            <p>Once saved, a reminder is a row with a due time. A scheduler sends it when it&apos;s due, every day if it repeats. No AI at send time, so nothing to misread.</p>
          </article>
        </div>
      </Section>

      <Section id="hood" label="Under the hood" title="Three things the user never sees">
        <div className="split">
          <div>
            <p className="readout__h label"><span>Live: the chat, and the window</span></p>
            <RemindersChat />
            <p className="readout__h label mt-5"><span>Live: the model call</span></p>
            <RemindersParsed />
            <p className="readout__h label mt-5"><span>Live: the latest API call</span></p>
            <RemindersApi />
          </div>
          <div className="prose">
            <p>A business number on the WhatsApp Business Platform gets messages by webhook: Meta POSTs JSON to a URL you register, signed with your app secret in an <code>X-Hub-Signature-256</code> header. Check the signature, answer 200 quickly, and do the slow work, like calling a model, afterwards. Webhooks that don&apos;t get a quick 200 are sent again.</p>
            <p>The prompt has to carry the context the model can&apos;t know: the current date, time and the user&apos;s timezone. Ask for a schema, and allow <code>at: null</code> so &ldquo;later&rdquo; produces a question instead of a guess.</p>
            <p>Then there&apos;s the rule that shapes the whole design. Within 24 hours of a user&apos;s last message you may reply freely. After that, a business can only send a template that Meta has reviewed in advance, like <code>reminder_due</code> with the task filled in. A reminder bot spends most of its life outside that window.</p>
          </div>
        </div>
      </Section>

      <Section id="breaks" label="When it breaks" title="Most failures are quiet ones">
        <div className="breaks">
          <article className="break">
            <span className="label">Scenario B · wrong timezone</span>
            <h3>Right answer, wrong clock</h3>
            <p>Servers run in UTC. Without the user&apos;s zone in the prompt, the model does what it&apos;s told and every reminder lands hours off. Repeating the time back in the confirmation is how users catch it.</p>
          </article>
          <article className="break">
            <span className="label">Scenario D · day two</span>
            <h3>The window closes</h3>
            <p>A reminder outside the 24-hour window, sent as plain text, fails with error 131047. It doesn&apos;t fail at the API call: it&apos;s reported later by a status webhook that many bots never read.</p>
          </article>
          <article className="break">
            <span className="label">Scenario C · no time given</span>
            <h3>Confident guesses</h3>
            <p>A model asked for a time will usually produce one. If the schema has no way to say &ldquo;unknown&rdquo;, &ldquo;later&rdquo; quietly becomes 5pm. Make uncertainty a valid answer.</p>
          </article>
        </div>
      </Section>

      <Section id="test" label="Test yourself" title="Two predictions">
        <RemindersChallenges />
      </Section>

      <Section id="simplified" label="Fine print" title="What this model leaves out">
        <div className="notes">
          <details>
            <summary>Opt-in and opt-out</summary>
            <div><p>Businesses need the user&apos;s permission to message them, and should honour &ldquo;stop&rdquo; at once. A real bot also handles replies like &ldquo;snooze&rdquo; or &ldquo;done&rdquo;, which is a second job for the model.</p></div>
          </details>
          <details>
            <summary>Template review and pricing</summary>
            <div><p>Templates are submitted to Meta and approved or rejected by category, such as utility or marketing. Template messages are charged, at rates that vary by country and category.</p></div>
          </details>
          <details>
            <summary>Duplicate webhooks</summary>
            <div><p>A retried webhook would create the same reminder twice. Real bots record each message&apos;s id and skip ones they&apos;ve seen, the idempotency check the AI automations topic shows.</p></div>
          </details>
          <details>
            <summary>A scheduler that sleeps</summary>
            <div><p>Here the clock jumps to each reminder. A real scheduler runs every minute or uses a delayed-job queue, and has to cope with being down when a reminder was due: send it late, or skip it and say so.</p></div>
          </details>
        </div>
      </Section>
    </RemindersProvider>
  );
}
