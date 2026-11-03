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
  {
    slug: "llms", title: "LLMs", status: "published", collection: "ai", estimatedMinutes: 7,
    question: "How does a model generate its next token?",
    description: "An interactive simulation of a language model generating text: tokenisation, the context window, one forward pass per token, temperature and sampling, forgetting and hallucination.",
    learningObjectives: ["Explain generation as a loop of next-token predictions, and predict what temperature and a full context window do to the answer."],
    relatedTopics: ["rag", "ai-agents", "ai-automations"],
    plate: { size: "wide", stock: "clay" },
  },
  {
    slug: "docker", title: "Docker", status: "published", collection: "infra", estimatedMinutes: 6,
    question: "What actually happens when you run a container?",
    description: "An interactive simulation of docker run: image layers and the layer cache, namespaces and cgroups, OOM kills, and a writable layer that disappears with its container.",
    learningObjectives: ["Predict what a run downloads, what limits a container, and which of its files survive."],
    relatedTopics: ["kubernetes", "ci-cd", "github-actions"],
    plate: { size: "medium", stock: "film" },
  },
  {
    slug: "kubernetes", title: "Kubernetes", status: "published", collection: "infra", estimatedMinutes: 9,
    question: "Who keeps your applications running when things fail?",
    description: "An interactive simulation of a Kubernetes Deployment: control loops, scheduling, node failure, capacity, rolling updates and a stalled rollout.",
    learningObjectives: ["Explain self-healing as reconciliation, and predict how a cluster reacts to lost pods, lost nodes and bad rollouts."],
    relatedTopics: ["docker", "apache-kafka", "ci-cd"],
    plate: { size: "medium", stock: "ochre" },
  },
  {
    slug: "ai-agents", title: "AI agents", status: "published", collection: "ai", estimatedMinutes: 7,
    question: "What happens when an AI can choose tools and take actions?",
    description: "An interactive simulation of an AI agent: tool calls, the agent loop, approval for side effects, failing tools, step budgets and prompt injection.",
    learningObjectives: ["Trace an agent's loop call by call, and say which guardrails belong in the runtime rather than the prompt."],
    relatedTopics: ["llms", "rag", "ai-automations"],
    plate: { size: "wide", stock: "ink" },
  },
  {
    slug: "rag", title: "RAG", status: "published", collection: "ai", estimatedMinutes: 6,
    question: "How can an AI answer questions using external knowledge?",
    description: "An interactive simulation of retrieval-augmented generation: chunking, embeddings, vector and keyword search, relevance thresholds, grounded prompts and a stale index.",
    learningObjectives: ["Follow a question through retrieval to a cited answer, and predict when RAG answers wrongly, guesses or refuses."],
    relatedTopics: ["llms", "ai-agents", "redis"],
    plate: { size: "wide", stock: "paper" },
  },
  {
    slug: "ai-automations", title: "AI automations", status: "published", collection: "ai", estimatedMinutes: 6,
    question: "How does a workflow like n8n turn an email into an action?",
    description: "An interactive simulation of an AI workflow automation, in the style of n8n and Flowise: triggers, JSON items, an AI node with structured output, routing, invalid output and duplicate triggers.",
    learningObjectives: ["Read a node-based workflow, follow an item through it, and plan for an AI step that fails or a trigger that fires twice."],
    relatedTopics: ["ai-agents", "llms", "github-actions"],
    plate: { size: "medium", stock: "film" },
  },
  {
    slug: "ci-cd", title: "CI/CD", status: "published", collection: "shipping", estimatedMinutes: 5,
    question: "How does code travel from a developer's laptop to production?",
    description: "An interactive simulation of a delivery pipeline: build once, test gates, artifact promotion, approval, canary releases and rollback.",
    learningObjectives: ["Trace a commit through a pipeline and predict where each kind of defect is caught, and at what cost."],
    relatedTopics: ["github-actions", "docker", "kubernetes"],
    plate: { size: "medium", stock: "clay" },
  },
  {
    slug: "github-actions", title: "GitHub Actions", status: "published", collection: "shipping", estimatedMinutes: 5,
    question: "What happens after you push a commit?",
    description: "An interactive simulation of a GitHub Actions workflow run: triggers, the job graph, matrix and fail-fast, if conditions, concurrency, runners and the dependency cache.",
    learningObjectives: ["Read a workflow file and predict which jobs run, in what order, on which machines, and with what files."],
    relatedTopics: ["ci-cd", "docker", "kubernetes"],
    plate: { size: "wide", stock: "ochre" },
  },
  planned({ slug: "nginx", title: "Nginx", collection: "request", estimatedMinutes: 5, question: "How does one server handle thousands of connections?", plate: { size: "wide", stock: "film" } }),
  planned({ slug: "databases", title: "Databases", collection: "memory", estimatedMinutes: 8, question: "What really happens when you execute a query?", plate: { size: "medium", stock: "paper" } }),
];
