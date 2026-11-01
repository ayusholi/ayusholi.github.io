"use client";

import { Challenge } from "@/components/ui/Challenge";
import { useTimelineFrame } from "@/lib/simulation/useTimeline";
import { useKafka } from "./KafkaProvider";
import { cliTable } from "./kafka-content";
import { activeConsumers, createState } from "./kafka-engine";

// `kafka-consumer-groups --describe`, reading the simulation on the page.
export const KafkaCli = () => {
  const { timeline } = useKafka();
  const { state } = useTimelineFrame(timeline);
  const { head, rows } = cliTable(state);
  return (
    <pre className="cli" id="cli" tabIndex={0} aria-label="Consumer group status table">
      <span className="dim">$ kafka-consumer-groups --describe --group demo</span>{`\n\n${head}\n${rows.join("\n")}`}
    </pre>
  );
};

export const KafkaChallenges = () => (
  <>
    <Challenge
      id="challenge"
      question="A topic has six partitions. A group has eight consumers. How many can actively consume this topic at the same time?"
      options={["Eight. Partitions are shared between them.", "Six. The other two stay idle.", "One. Only the group leader reads.", "Four. Kafka keeps spares in reserve."]}
      answer={1}
      verdict={() => {
        const s = createState({ partitions: 6, consumers: 8 });
        return `In the simulation, ${activeConsumers(s)} of ${s.consumers.length} consumers end up with a partition. Each partition has at most one owner in a group, so the partition count caps parallelism. The two spares aren't useless: they take over when an active member fails.`;
      }}
    />
    <Challenge
      id="challenge-2"
      className="mt-11"
      question="Records A1 and B1 land in different partitions, with A1 written first. In what order will a consumer group process them?"
      options={["A1 then B1, because A1 has the earlier timestamp.", "B1 then A1, because the newest record goes first.", "Either order. Kafka only orders records within a partition."]}
      answer={2}
      verdict={() => "Offsets are per partition, so there's no number that compares A1 with B1. If two events must stay in order, give them the same key so they share a partition."}
    />
  </>
);
