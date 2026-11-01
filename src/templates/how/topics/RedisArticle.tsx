import { notFound } from "next/navigation";
import { Section } from "@/components/layout/Section";
import { PageContainer } from "@/components/layout/PageContainer";
import { TopicHeader } from "@/components/topics/TopicHeader";
import { getTopic } from "@/lib/content";
import { RedisBench } from "@/features/redis/RedisBench";
import { RedisChallenge, RedisCode, RedisWireLog } from "@/features/redis/RedisLivePanels";
import { RedisProvider } from "@/features/redis/RedisProvider";
import { StampedeBench } from "@/features/redis/StampedeBench";

// Prose renders on the server. The live panels between it are small client
// components sharing one simulation through RedisProvider.
export default async function RedisArticle() {
  const topic = await getTopic("redis");
  if (!topic) notFound();
  return (
    <RedisProvider>
      <TopicHeader
        topic={topic}
        mechanism={1}
        headline="Why does the same request sometimes take 5 ms and sometimes 150 ms?"
        lede="Because the application may never have to reach the database. Redis keeps a copy of the answer in memory, and the speed comes with new ways to be wrong."
        note="All timings on this page are illustrative. They show the shape of the difference, not what your system will do."
      />

      <PageContainer aria-label="Redis simulation">
        <RedisBench />
        <noscript><p className="prose">This simulation needs JavaScript. The explanations below still work without it.</p></noscript>
      </PageContainer>

      <Section id="hood" label="Under the hood" title="The cache is a decision in your code">
        <div className="split">
          <div>
            <p className="readout__h label"><span>Live: the line running now</span><span>cache-aside.js</span></p>
            <RedisCode />
          </div>
          <div className="prose">
            <p>Redis doesn&apos;t sit in front of Postgres, and it has never heard of your database. This pattern is called <strong>cache-aside</strong>: the application reads the cache, falls through on a miss, and writes the result back. Every behaviour above is a line in that function.</p>
            <p>Note that an update <em>deletes</em> the key rather than overwriting it. Two concurrent writers can apply their cache writes in the wrong order and leave an old value behind for a full TTL. Deleting narrows that window, and the next read repopulates from the truth.</p>
            <div>
              <p className="readout__h label mt-5"><span>On the wire</span></p>
              <RedisWireLog />
            </div>
          </div>
        </div>
      </Section>

      <Section id="breaks" label="When it breaks" title="A cache hides load until it can't">
        <div className="split">
          <StampedeBench />
          <div className="prose">
            <p>A <strong>cache stampede</strong> happens when a popular key expires and every waiting request misses together. Postgres suddenly sees the traffic the cache was absorbing. Run it both ways and watch the query counter on the database.</p>
            <p>Common defences are a short lock so one request rebuilds the entry, adding random jitter to TTLs so keys don&apos;t expire together, and refreshing popular keys before they expire.</p>
          </div>
        </div>
        <div className="breaks mt-7">
          <article className="break">
            <span className="label">Scenario E</span>
            <h3>An outage can be slower than a miss</h3>
            <p>The bypass path here takes 198 ms against 150 ms for a miss, because the application waits out a timeout before giving up. Short timeouts and circuit breakers exist for this reason.</p>
          </article>
          <article className="break">
            <span className="label">Scenario D</span>
            <h3>A TTL is a bound, not a fix</h3>
            <p>Without invalidation, a value can be wrong for as long as its TTL. A short TTL shrinks that window and costs more misses. There&apos;s no setting that gives you neither.</p>
          </article>
          <article className="break">
            <span className="label">Capacity</span>
            <h3>Bypassing assumes Postgres can cope</h3>
            <p>If the cache was absorbing most reads, “fall back to the database” can turn a Redis outage into a database outage. Failing fast is sometimes the safer choice.</p>
          </article>
        </div>
      </Section>

      <Section id="test" label="Test yourself" title="Predict it first">
        <RedisChallenge />
      </Section>

      <Section id="simplified" label="Fine print" title="What this model leaves out">
        <div className="notes">
          <details>
            <summary>Expiry doesn&apos;t happen at a precise moment in memory</summary>
            <div><p>The struck-through row shows this. Redis removes expired keys when they&apos;re accessed, and with a background sampler. Either way an expired key is never returned to a client, so the logical behaviour is exact even though memory is reclaimed later.</p></div>
          </details>
          <details>
            <summary>Restarting Redis doesn&apos;t always empty it</summary>
            <div><p>The simulated restart loses everything, as a pure cache with persistence turned off would. With RDB snapshots or an AOF, keys can return after a restart, including ones whose invalidation failed during the outage.</p></div>
          </details>
          <details>
            <summary>Redis is more than a cache</summary>
            <div><p>This page covers its most common role. It also offers lists, sets, sorted sets, streams and pub/sub. Replication, clustering and eviction under memory pressure (<span className="inline-code">maxmemory-policy</span>) are all out of scope here.</p></div>
          </details>
          <details>
            <summary>The timings are invented</summary>
            <div><p>They were picked to give 5 ms and 150 ms. Real numbers depend on network distance, payload size, query plans and load. A well-indexed Postgres read can be very fast. What holds up is the shape: a network round trip to memory usually costs far less than a query that has to do real work.</p></div>
          </details>
        </div>
      </Section>
    </RedisProvider>
  );
}
