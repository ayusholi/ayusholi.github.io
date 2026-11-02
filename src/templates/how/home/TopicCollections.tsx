import Link from "next/link";
import type { Collection } from "@/lib/content/content-types";
import { Section } from "@/components/layout/Section";
import { topicUrl } from "@/lib/site";

export const TopicCollections = ({ collections }: { collections: Collection[] }) => (
  <Section id="coll-h" anchor="collections" label="Collections" title="How the pieces connect">
    <div className="index">
      {collections.map((c, i) => (
        <details key={c.id} className="coll" data-find={`${c.title} ${c.concepts.map((x) => x.name).join(" ")}`.toLowerCase()}>
          <summary>
            <span className="label">{String(i + 1).padStart(2, "0")}</span>
            <span className="coll__t">{c.title}</span>
            <span className="coll__l">{c.line}</span>
            <span className="label">{c.concepts.length} concepts</span>
          </summary>
          <div className="coll__items">
            {c.concepts.map((x) => (x.topic
              ? <Link key={x.name} className="concept" href={topicUrl(x.topic)}>{x.name}</Link>
              : <span key={x.name} className="concept">{x.name}</span>))}
          </div>
        </details>
      ))}
    </div>
  </Section>
);
