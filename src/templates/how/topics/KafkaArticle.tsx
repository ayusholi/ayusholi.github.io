import { notFound } from "next/navigation";
import { Section } from "@/components/layout/Section";
import { PageContainer } from "@/components/layout/PageContainer";
import { TopicHeader } from "@/components/topics/TopicHeader";
import { getTopic } from "@/lib/content";
import { KafkaBench } from "@/features/kafka/KafkaBench";
import { KafkaChallenges, KafkaCli } from "@/features/kafka/KafkaLivePanels";
import { KafkaProvider } from "@/features/kafka/KafkaProvider";

const LOOP = [
  "while (running) {",
  "  const batch = await consumer.poll();",
  "  for (const record of batch) {",
  "    await handle(record);    // crash here…",
  "  }",
  "  await consumer.commit();   // …and this never ran",
  "}",
];

// Prose renders on the server. The live panels between it are small client
// components sharing one simulation through KafkaProvider.
export default async function KafkaArticle() {
  const topic = await getTopic("apache-kafka");
  if (!topic) notFound();
  return (
    <KafkaProvider>
      <TopicHeader
        topic={topic}
        mechanism={2}
        headline="How does data move between systems that never talk to each other?"
        lede="They share a log. Producers append to the end of a tape, and each reader keeps its own place. Reading removes nothing, and most of what makes Kafka unusual follows from that."
        note="One topic, one consumer group, one simulated clock. Each tick is a chance for every running consumer to process one record."
      />

      <PageContainer aria-label="Kafka simulation">
        <KafkaBench />
        <noscript><p className="prose">This simulation needs JavaScript. The explanations below still work without it.</p></noscript>
      </PageContainer>

      <Section id="ideas" label="The model" title="Four rules explain most of it">
        <div className="breaks">
          <article className="break">
            <span className="label">Rule 1</span>
            <h3>A partition is an append-only log</h3>
            <p>Records are added at the end and get the next offset. Retention removes old records later, but consuming never does. Two groups can read the same data independently.</p>
          </article>
          <article className="break">
            <span className="label">Rule 2</span>
            <h3>Order exists within a partition</h3>
            <p>There&apos;s no order across a multi-partition topic. If events about one customer must stay in sequence, give them a key so they share a partition.</p>
          </article>
          <article className="break">
            <span className="label">Rule 3</span>
            <h3>One owner per partition, per group</h3>
            <p>That&apos;s what keeps a partition&apos;s order intact while it&apos;s processed. It also means more consumers than partitions adds spares, not throughput.</p>
          </article>
        </div>
        <div className="breaks -mt-px grid-cols-1!">
          <article className="break">
            <span className="label">Rule 4</span>
            <h3>Progress is a number the consumer commits</h3>
            <p>The broker doesn&apos;t track each record as done. A group stores an offset per partition, and lag is the gap between that offset and the end of the log. Everything about redelivery follows from when that number gets written.</p>
          </article>
        </div>
      </Section>

      <Section id="hood" label="Under the hood" title="The same state, as an operator sees it">
        <div className="split">
          <div>
            <p className="readout__h label"><span>Live: this table reads the simulation above</span></p>
            <KafkaCli />
          </div>
          <div className="prose">
            <p>This is the shape of <span className="inline-code">kafka-consumer-groups --describe</span>. <strong>CURRENT-OFFSET</strong> is what the group last committed, so it moves in steps and lags behind the yellow cursor while a batch is in progress. The dashed line on each tape marks it.</p>
            <p>A consumer is a loop around <span className="inline-code">poll()</span>: fetch a batch, process it, commit. The order of those last two steps is the choice between processing a record twice and possibly not at all.</p>
            <pre className="code" tabIndex={0} aria-label="Consumer loop example"><code>{LOOP.map((line) => <span className="ln" key={line}>{line}</span>)}</code></pre>
          </div>
        </div>
      </Section>

      <Section id="breaks" label="When it breaks" title="Guarantees depend on what you built">
        <div className="breaks">
          <article className="break">
            <span className="label">Commit after · at-least-once</span>
            <h3>Crash, and records come back</h3>
            <p>Experiment 4. The successor restarts from the last commit, so work between that commit and the crash runs again. Nothing is lost, and side effects may repeat.</p>
          </article>
          <article className="break">
            <span className="label">Commit before · at-most-once</span>
            <h3>Crash, and records vanish</h3>
            <p>Set “Commit: Before”, send 10 records, and crash a consumer while it&apos;s working. “Never processed” climbs: the group has moved past records nobody handled.</p>
          </article>
          <article className="break">
            <span className="label">The practical answer</span>
            <h3>Assume delivery can repeat</h3>
            <p>Make handlers idempotent, for instance with a unique constraint on a record&apos;s ID. Turn on “Idempotent application” and duplicates arrive but do nothing.</p>
          </article>
        </div>
        <div className="prose mt-6">
          <p>Kafka&apos;s transactions give exactly-once processing for read-process-write flows inside Kafka. They don&apos;t extend to an arbitrary database or an email provider on the other side of your handler. That part is still yours to design.</p>
        </div>
      </Section>

      <Section id="test" label="Test yourself" title="Two predictions">
        <KafkaChallenges />
      </Section>

      <Section id="simplified" label="Fine print" title="What this model leaves out">
        <div className="notes">
          <details>
            <summary>Brokers, replication and leaders</summary>
            <div><p>The tapes behave as one reliable log. Real partitions are replicated across brokers with a leader and followers, and <span className="inline-code">acks</span> and <span className="inline-code">min.insync.replicas</span> decide what “written” means.</p></div>
          </details>
          <details>
            <summary>Partitioning and assignment</summary>
            <div><p>The default partitioner hashes keys with murmur2, and keyless records go in sticky batches, far larger than the two records used here. Assignment here is a simple range. Real strategies include cooperative-sticky, which avoids stopping every consumer during a rebalance.</p></div>
          </details>
          <details>
            <summary>Commits and timing</summary>
            <div><p>Commits are offsets stored in an internal topic, and clients often commit on a timer. Lag here is measured from the committed offset, as the CLI does. A running consumer&apos;s real position is usually ahead of it. Sessions are measured in seconds, not ticks.</p></div>
          </details>
          <details>
            <summary>Pausing a consumer</summary>
            <div><p>This models the client&apos;s <span className="inline-code">pause()</span>, which stops fetching while polling continues. A consumer that simply stops calling <span className="inline-code">poll()</span> for too long gets removed from the group, which looks more like the crash path.</p></div>
          </details>
        </div>
      </Section>
    </KafkaProvider>
  );
}
