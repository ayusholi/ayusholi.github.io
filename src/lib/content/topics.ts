import type { Topic } from "./content-types";

// The local content source. Order sets the plates' composition on the homepage:
// each row of sizes adds up to twelve columns (see .plate--* in publication.css).
const planned = (t: Omit<Topic, "status" | "description" | "learningObjectives" | "relatedTopics">): Topic => ({
  ...t, status: "coming-soon", description: t.question, learningObjectives: [], relatedTopics: [],
});

export const TOPICS: Topic[] = [
  {
    slug: "redis", title: "Redis", status: "published", collection: "memory", estimatedMinutes: 6,
    question: "What happens when an application remembers something?",
    description: "An interactive simulation of Redis as a cache: hits, misses, expiry, invalidation and outages, driven by a real state model.",
    learningObjectives: ["Read a cache-aside path and predict hits, misses, expiry, staleness and outages."],
    relatedTopics: ["apache-kafka", "databases", "nginx"],
    plate: { size: "hero", stock: "paper" },
  },
  {
    slug: "apache-kafka", title: "Apache Kafka", status: "published", collection: "distributed", estimatedMinutes: 8,
    question: "How does data move between independent systems?",
    description: "An interactive simulation of Apache Kafka: partitions, offsets, consumer groups, lag, rebalancing and reprocessing.",
    learningObjectives: ["Predict ordering, parallelism, lag and reprocessing from a topic's layout."],
    relatedTopics: ["redis", "kubernetes", "ai-agents"],
    plate: { size: "tall", stock: "ink" },
  },
  planned({ slug: "llms", title: "LLMs", collection: "ai", estimatedMinutes: 7, question: "How does a model generate its next token?", plate: { size: "wide", stock: "clay" } }),
  planned({ slug: "docker", title: "Docker", collection: "infra", estimatedMinutes: 6, question: "What actually happens when you run a container?", plate: { size: "medium", stock: "film" } }),
  planned({ slug: "kubernetes", title: "Kubernetes", collection: "infra", estimatedMinutes: 9, question: "Who keeps your applications running when things fail?", plate: { size: "medium", stock: "ochre" } }),
  planned({ slug: "ai-agents", title: "AI agents", collection: "ai", estimatedMinutes: 7, question: "What happens when an AI can choose tools and take actions?", plate: { size: "wide", stock: "ink" } }),
  planned({ slug: "rag", title: "RAG", collection: "ai", estimatedMinutes: 6, question: "How can an AI answer questions using external knowledge?", plate: { size: "small", stock: "paper" } }),
  planned({ slug: "databases", title: "Databases", collection: "memory", estimatedMinutes: 8, question: "What really happens when you execute a query?", plate: { size: "small", stock: "film" } }),
  planned({ slug: "nginx", title: "Nginx", collection: "request", estimatedMinutes: 5, question: "How does one server handle thousands of connections?", plate: { size: "small", stock: "paper" } }),
  planned({ slug: "ci-cd", title: "CI/CD", collection: "shipping", estimatedMinutes: 5, question: "How does code travel from a developer's laptop to production?", plate: { size: "medium", stock: "clay" } }),
  planned({ slug: "github-actions", title: "GitHub Actions", collection: "shipping", estimatedMinutes: 5, question: "What happens after you push a commit?", plate: { size: "wide", stock: "ochre" } }),
];
