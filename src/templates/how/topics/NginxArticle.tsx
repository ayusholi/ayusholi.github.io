import { notFound } from "next/navigation";
import { Section } from "@/components/layout/Section";
import { PageContainer } from "@/components/layout/PageContainer";
import { TopicHeader } from "@/components/topics/TopicHeader";
import { getTopic } from "@/lib/content";
import { NginxBench } from "@/features/nginx/NginxBench";
import { NginxChallenges, NginxConfigPanel, NginxStatus } from "@/features/nginx/NginxLivePanels";
import { NginxProvider } from "@/features/nginx/NginxProvider";

// Prose renders on the server. The live panels between it are small client
// components sharing one simulation through NginxProvider.
export default async function NginxArticle() {
  const topic = await getTopic("nginx");
  if (!topic) notFound();
  return (
    <NginxProvider>
      <TopicHeader
        topic={topic}
        mechanism={11}
        headline="How does one server hold ten thousand connections without breaking a sweat?"
        lede="Most connections are idle most of the time. Nginx keeps them all in a few event loops, sends the real work to app servers behind it, and quietly steps around the ones that have crashed."
        note="Requests run one at a time, and memory and timings are round numbers. The idle-connection cost is the one nginx.org quotes."
      />

      <PageContainer aria-label="Nginx simulation">
        <NginxBench />
        <noscript><p className="prose">This simulation needs JavaScript. The explanations below still work without it.</p></noscript>
      </PageContainer>

      <Section id="ideas" label="The model" title="Three ideas explain most of it">
        <div className="breaks">
          <article className="break">
            <span className="label">Idea 1 · the event loop</span>
            <h3>Waiting costs nothing</h3>
            <p>Each worker asks the kernel which of its connections are ready, handles those and asks again. A quiet connection is a few hundred bytes in a list, not a thread blocked on it.</p>
          </article>
          <article className="break">
            <span className="label">Idea 2 · the reverse proxy</span>
            <h3>One front door</h3>
            <p>Clients only ever talk to nginx. It answers static files itself and forwards everything else to app servers it chooses, so they can be added, removed or restarted unseen.</p>
          </article>
          <article className="break">
            <span className="label">Idea 3 · failure handling</span>
            <h3>Retry, then route around</h3>
            <p>A refused connection is retried on the next server, and the broken one is marked down for a while. Visitors only see an error when nobody is left.</p>
          </article>
        </div>
      </Section>

      <Section id="hood" label="Under the hood" title="A config file that describes the traffic">
        <div className="split">
          <div>
            <p className="readout__h label"><span>Live: the directive at work</span></p>
            <NginxConfigPanel />
            <p className="readout__h label mt-5"><span>Live: connections right now</span></p>
            <NginxStatus />
          </div>
          <div className="prose">
            <p>Older web servers gave each connection a process or a thread. That&apos;s simple to program, but every thread needs its own stack, and a thread waiting on a slow or silent client does nothing while holding it. Ten thousand connections meant ten thousand threads: the C10k problem.</p>
            <p>Nginx starts one worker per CPU core instead, and each one handles thousands of connections without blocking: it reads whatever has arrived, writes whatever the socket can take, and moves on. With <code>worker_connections 16384</code> and four workers, that&apos;s 65,536 connections from four processes.</p>
            <p>The <code>upstream</code> block is the load balancer. Round robin is the default; <code>least_conn</code> and <code>ip_hash</code> are one line away. <code>proxy_buffering</code> decides who waits for a slow client: nginx, cheaply, or your app server, expensively. Press &ldquo;A slow phone&rdquo; with it on and off, and watch app time.</p>
          </div>
        </div>
      </Section>

      <Section id="breaks" label="When it breaks" title="Where the limits really are">
        <div className="breaks">
          <article className="break">
            <span className="label">Scenario D · one thread each</span>
            <h3>Idle clients, full server</h3>
            <p>A thread-per-connection server can be &ldquo;full&rdquo; while doing no work at all. Putting nginx in front of one fixes it: nginx holds the idle crowd and passes on only real requests.</p>
          </article>
          <article className="break">
            <span className="label">Scenario E · app down</span>
            <h3>All upstreams down</h3>
            <p>Retries hide one dead server. When every server is marked down, the answer is 502 Bad Gateway, which means nginx is fine and everything behind it isn&apos;t.</p>
          </article>
          <article className="break">
            <span className="label">The other limits</span>
            <h3>File descriptors and timeouts</h3>
            <p>Every connection is a file descriptor, so the operating system&apos;s limit has to be raised to match. And a slow app shows up as 504 Gateway Timeout, which no amount of nginx tuning fixes.</p>
          </article>
        </div>
      </Section>

      <Section id="test" label="Test yourself" title="Two predictions">
        <NginxChallenges />
      </Section>

      <Section id="simplified" label="Fine print" title="What this model leaves out">
        <div className="notes">
          <details>
            <summary>Concurrency</summary>
            <div><p>Here requests run one at a time so each step can be read. Real workers interleave thousands of requests, each a few steps along, which is the whole point of the event loop.</p></div>
          </details>
          <details>
            <summary>TLS and HTTP/2</summary>
            <div><p>Nginx usually terminates TLS too, doing the handshake and decryption so app servers speak plain HTTP on a private network. HTTP/2 and HTTP/3 also let one connection carry many requests at once.</p></div>
          </details>
          <details>
            <summary>Active health checks</summary>
            <div><p>Open-source nginx notices failures passively, from real requests, as shown. NGINX Plus and other proxies can also probe servers on a schedule and remove them before a visitor hits one.</p></div>
          </details>
          <details>
            <summary>Caching</summary>
            <div><p>With <code>proxy_cache</code>, nginx can keep app responses on disk and serve repeat requests without asking an app server at all, the same idea the Redis topic explores.</p></div>
          </details>
        </div>
      </Section>
    </NginxProvider>
  );
}
