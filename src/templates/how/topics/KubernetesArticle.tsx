import { notFound } from "next/navigation";
import { Section } from "@/components/layout/Section";
import { PageContainer } from "@/components/layout/PageContainer";
import { TopicHeader } from "@/components/topics/TopicHeader";
import { getTopic } from "@/lib/content";
import { KubernetesBench } from "@/features/kubernetes/KubernetesBench";
import { KubernetesChallenges, KubernetesCli, KubernetesLoop } from "@/features/kubernetes/KubernetesLivePanels";
import { KubernetesProvider } from "@/features/kubernetes/KubernetesProvider";

// Prose renders on the server. The live panels between it are small client
// components sharing one simulation through KubernetesProvider.
export default async function KubernetesArticle() {
  const topic = await getTopic("kubernetes");
  if (!topic) notFound();
  return (
    <KubernetesProvider>
      <TopicHeader
        topic={topic}
        mechanism={4}
        headline="Who restarts your app when a machine dies at 3 a.m.?"
        lede="Nobody does, exactly. You write down what should be running, and a handful of small loops keep comparing that with what is running. Each one fixes the one difference it's responsible for, over and over."
        note="One Deployment on three nodes. Each tick, every control loop gets one look at the cluster. Real timeouts are seconds to minutes, not ticks."
      />

      <PageContainer aria-label="Kubernetes simulation">
        <KubernetesBench />
        <noscript><p className="prose">This simulation needs JavaScript. The explanations below still work without it.</p></noscript>
      </PageContainer>

      <Section id="ideas" label="The model" title="Three ideas explain most of it">
        <div className="breaks">
          <article className="break">
            <span className="label">Idea 1</span>
            <h3>You declare, you don&apos;t command</h3>
            <p><span className="inline-code">kubectl</span> writes a record: three replicas of this image. It doesn&apos;t start anything. Deleting a pod by hand is just another change the loops will notice and undo.</p>
          </article>
          <article className="break">
            <span className="label">Idea 2</span>
            <h3>Small loops, one job each</h3>
            <p>The controller counts pods. The scheduler places them. A kubelet runs what&apos;s placed on its node. None of them knows the others exist, and each one only talks to the API server.</p>
          </article>
          <article className="break">
            <span className="label">Idea 3</span>
            <h3>Everything is a belief</h3>
            <p>The control plane only knows what kubelets last reported. A node that dies can&apos;t report it, so for a while a pod can be listed as ready on a machine that no longer exists.</p>
          </article>
        </div>
      </Section>

      <Section id="hood" label="Under the hood" title="Every controller is the same loop">
        <div className="split">
          <div>
            <p className="readout__h label"><span>Live: the loop acting now</span></p>
            <KubernetesLoop />
            <p className="readout__h label mt-5"><span>Live: this reads the simulation above</span></p>
            <KubernetesCli />
          </div>
          <div className="prose">
            <p>This loop is called <strong>reconciliation</strong>. It doesn&apos;t care how the difference arose. A pod you deleted, a pod lost with its node, or a replica count you raised all look the same to it: fewer pods than asked for.</p>
            <p>That&apos;s why it&apos;s robust. There&apos;s no “handle node failure” procedure to get wrong. There&apos;s one rule, applied continuously, by a component that can itself crash and restart without losing anything, because all the state lives in the API server.</p>
            <p>It&apos;s also why it&apos;s slow to react. A loop only acts on what it can see, and a missing heartbeat looks the same as a late one until a timeout says otherwise.</p>
          </div>
        </div>
      </Section>

      <Section id="breaks" label="When it breaks" title="It keeps the spec, not your intentions">
        <div className="breaks">
          <article className="break">
            <span className="label">Scenario 2 · minutes, not seconds</span>
            <h3>A dead node takes a while to notice</h3>
            <p>By default it&apos;s marked NotReady after about 40 seconds of silence, and its pods are evicted around five minutes later. Run more than one replica, on more than one node.</p>
          </article>
          <article className="break">
            <span className="label">Scenario 3 · Pending</span>
            <h3>It can&apos;t make machines</h3>
            <p>If the pods don&apos;t fit, they wait. A cluster autoscaler can add nodes in response to Pending pods, but that&apos;s a separate component, and it takes minutes too.</p>
          </article>
          <article className="break">
            <span className="label">Scenario 5 · a stuck rollout</span>
            <h3>Readiness is what saves you</h3>
            <p>The bad rollout was harmless only because the new pod never became ready. A pod that passes its readiness check while broken gets traffic, and the rollout carries on happily.</p>
          </article>
        </div>
      </Section>

      <Section id="test" label="Test yourself" title="Two predictions">
        <KubernetesChallenges />
      </Section>

      <Section id="simplified" label="Fine print" title="What this model leaves out">
        <div className="notes">
          <details>
            <summary>Watches, not polling</summary>
            <div><p>Components don&apos;t re-read everything each round. They hold a watch on the API server and get told about changes, then reconcile what changed. The behaviour is the same as the loop here, with far less traffic.</p></div>
          </details>
          <details>
            <summary>ReplicaSets</summary>
            <div><p>A Deployment doesn&apos;t own pods directly. It owns one ReplicaSet per pod template, and scales the new one up and the old one down during a rollout. The two are merged into one controller here.</p></div>
          </details>
          <details>
            <summary>Scheduling and resources</summary>
            <div><p>Pods request CPU and memory, and the scheduler filters and scores nodes on those, plus affinity rules, taints and spreading constraints. Here every pod takes one of three slots.</p></div>
          </details>
          <details>
            <summary>Pods on a lost node</summary>
            <div><p>Evicted pods are removed here at once. In a real cluster they can sit in Terminating or Unknown until the node returns or someone force-deletes them. For a StatefulSet, Kubernetes deliberately won&apos;t start a replacement until it&apos;s sure the old one is gone.</p></div>
          </details>
          <details>
            <summary>Services and traffic</summary>
            <div><p>“Serving” assumes a Service sends traffic to every ready pod. The endpoints controller that does that is one more loop, watching readiness, and isn&apos;t drawn.</p></div>
          </details>
        </div>
      </Section>
    </KubernetesProvider>
  );
}
