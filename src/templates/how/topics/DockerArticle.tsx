import { notFound } from "next/navigation";
import { Section } from "@/components/layout/Section";
import { PageContainer } from "@/components/layout/PageContainer";
import { TopicHeader } from "@/components/topics/TopicHeader";
import { getTopic } from "@/lib/content";
import { DockerBench } from "@/features/docker/DockerBench";
import { DockerChallenges, DockerfilePanel, DockerTerminal } from "@/features/docker/DockerLivePanels";
import { DockerProvider } from "@/features/docker/DockerProvider";

// Prose renders on the server. The live panels between it are small client
// components sharing one simulation through DockerProvider.
export default async function DockerArticle() {
  const topic = await getTopic("docker");
  if (!topic) notFound();
  return (
    <DockerProvider>
      <TopicHeader
        topic={topic}
        mechanism={3}
        headline="What actually happens when you type docker run?"
        lede="No virtual machine boots. Docker downloads the layers it's missing, stacks them into a filesystem, and asks the Linux kernel to start one ordinary process that can only see what it's been given."
        note="All timings on this page are illustrative. They show where the time goes, not what your machine will do."
      />

      <PageContainer aria-label="Docker simulation">
        <DockerBench />
        <noscript><p className="prose">This simulation needs JavaScript. The explanations below still work without it.</p></noscript>
      </PageContainer>

      <Section id="ideas" label="The model" title="Three ideas explain most of it">
        <div className="breaks">
          <article className="break">
            <span className="label">Idea 1</span>
            <h3>An image is a stack of layers</h3>
            <p>Each instruction in a Dockerfile that changes files makes one read-only layer, named by a hash of its content. Two images that share a base share those bytes on disk and over the network.</p>
          </article>
          <article className="break">
            <span className="label">Idea 2</span>
            <h3>A container is a process</h3>
            <p>Namespaces give it a private view of process IDs, mounts and the network. A cgroup caps its memory and CPU. Underneath, it&apos;s one more process on the host&apos;s kernel.</p>
          </article>
          <article className="break">
            <span className="label">Idea 3</span>
            <h3>Its changes are disposable</h3>
            <p>Each container gets a thin writable layer on top of the image. Whatever it writes there disappears with it. Data that must outlive a container goes in a volume.</p>
          </article>
        </div>
      </Section>

      <Section id="hood" label="Under the hood" title="A Dockerfile is a list of layers">
        <div className="split">
          <div>
            <p className="readout__h label"><span>Live: the line that made this layer</span><span>Dockerfile</span></p>
            <DockerfilePanel />
            <p className="readout__h label mt-5"><span>Live: the terminal</span></p>
            <DockerTerminal />
          </div>
          <div className="prose">
            <p>Read the Dockerfile from the top. <span className="inline-code">FROM</span> brings in someone else&apos;s layers, here a slim Debian with Node installed. Each <span className="inline-code">RUN</span> and <span className="inline-code">COPY</span> adds one more.</p>
            <p>The order is deliberate. Dependencies change rarely and weigh a lot, so <span className="inline-code">package.json</span> is copied and installed first. Application code changes on every commit and weighs little, so it goes last. A change invalidates its own layer and every one above it, never the ones below.</p>
            <p>The <strong>host PID</strong> column shows the other half. Inside, the server is PID 1 and sees no other processes. Run <span className="inline-code">ps</span> on the host and it&apos;s there like any other program. Containers isolate processes. They don&apos;t virtualise hardware.</p>
          </div>
        </div>
      </Section>

      <Section id="breaks" label="When it breaks" title="Most surprises are one of these">
        <div className="breaks">
          <article className="break">
            <span className="label">Scenario D · exit 137</span>
            <h3>The kernel kills it, not Docker</h3>
            <p>Go over a cgroup&apos;s memory limit and the kernel&apos;s OOM killer sends SIGKILL. There&apos;s no exception to catch and no log line from your app. 137 means 128 + signal 9.</p>
          </article>
          <article className="break">
            <span className="label">Scenario E · missing data</span>
            <h3>The database was in the container</h3>
            <p>Removing and re-creating a container is routine: upgrades do it. Anything in the writable layer goes with it. Restarting keeps it, which is why the bug can hide for weeks.</p>
          </article>
          <article className="break">
            <span className="label">Scenario C · slow deploys</span>
            <h3>Every deploy downloads everything</h3>
            <p>Usually a Dockerfile copying the code before installing dependencies, or a base image tag that moves. Both make layers that could be shared look new.</p>
          </article>
        </div>
      </Section>

      <Section id="test" label="Test yourself" title="Two predictions">
        <DockerChallenges />
      </Section>

      <Section id="simplified" label="Fine print" title="What this model leaves out">
        <div className="notes">
          <details>
            <summary>Building images</summary>
            <div><p>Every image here already exists in the registry. <span className="inline-code">docker build</span> runs each instruction in a temporary container and snapshots the result as a layer, using the same rule for its cache: a layer is reused only if its instruction and everything below it are unchanged.</p></div>
          </details>
          <details>
            <summary>Downloads, compression and digests</summary>
            <div><p>Layers are compressed tarballs, fetched several at a time, and the ids here stand in for full sha256 digests. Unpacked sizes on disk are larger than what crosses the network.</p></div>
          </details>
          <details>
            <summary>Networking, users and security</summary>
            <div><p>Containers also get a network namespace with its own interfaces, usually bridged to the host. Real isolation also leans on dropped capabilities, seccomp filters and user namespaces, none of which are modelled.</p></div>
          </details>
          <details>
            <summary>Docker Desktop on a Mac or Windows</summary>
            <div><p>Containers need a Linux kernel, so Docker Desktop runs one in a small virtual machine and your containers run inside it. On a Linux server there&apos;s no VM at all, which is what this page shows.</p></div>
          </details>
        </div>
      </Section>
    </DockerProvider>
  );
}
