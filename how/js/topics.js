// The content registry. Adding a topic starts here: see how/README.md.
//
// status: "live" links to /how/<slug>/, "planned" is listed but not linked.
// size:   how much room the topic takes in the homepage composition.
// stock:  paper colour of its plate (paper | ink | ochre | clay | film).

export const TOPICS = [
  {
    slug: "redis", title: "Redis", status: "live", collection: "memory", minutes: 6, size: "hero", stock: "paper",
    question: "What happens when an application remembers something?",
    intro: "Why the same request can take 5 ms or 150 ms, and what it costs to make it fast.",
    objective: "Read a cache-aside path and predict hits, misses, expiry, staleness and outages.",
    related: ["kafka", "databases", "nginx"],
  },
  {
    slug: "kafka", title: "Apache Kafka", status: "live", collection: "distributed", minutes: 8, size: "tall", stock: "ink",
    question: "How does data move between independent systems?",
    intro: "Append-only logs, partitions, offsets, and the consumer group that shares them out.",
    objective: "Predict ordering, parallelism, lag and reprocessing from a topic's layout.",
    related: ["redis", "kubernetes", "ai-agents"],
  },
  { slug: "llms", title: "LLMs", status: "planned", collection: "ai", minutes: 7, size: "wide", stock: "clay", question: "How does a model generate its next token?" },
  { slug: "docker", title: "Docker", status: "planned", collection: "infra", minutes: 6, size: "medium", stock: "film", question: "What actually happens when you run a container?" },
  { slug: "kubernetes", title: "Kubernetes", status: "planned", collection: "infra", minutes: 9, size: "medium", stock: "ochre", question: "Who keeps your applications running when things fail?" },
  { slug: "ai-agents", title: "AI agents", status: "planned", collection: "ai", minutes: 7, size: "wide", stock: "ink", question: "What happens when an AI can choose tools and take actions?" },
  { slug: "rag", title: "RAG", status: "planned", collection: "ai", minutes: 6, size: "small", stock: "paper", question: "How can an AI answer questions using external knowledge?" },
  { slug: "databases", title: "Databases", status: "planned", collection: "memory", minutes: 8, size: "small", stock: "film", question: "What really happens when you execute a query?" },
  { slug: "nginx", title: "Nginx", status: "planned", collection: "request", minutes: 5, size: "small", stock: "paper", question: "How does one server handle thousands of connections?" },
  { slug: "ci-cd", title: "CI/CD", status: "planned", collection: "shipping", minutes: 5, size: "medium", stock: "clay", question: "How does code travel from a developer's laptop to production?" },
  { slug: "github-actions", title: "GitHub Actions", status: "planned", collection: "shipping", minutes: 5, size: "wide", stock: "ochre", question: "What happens after you push a commit?" },
];

export const COLLECTIONS = [
  { id: "request", title: "The Request Journey", line: "From a typed address to a response.", items: ["DNS", "HTTP", "Reverse proxies", "Nginx", "Load balancing", "APIs"] },
  { id: "memory", title: "Memory and Data", line: "Where state lives, and how it stays true.", items: ["Redis", "PostgreSQL", "Database indexes", "Transactions", "Connection pooling", "Database replication"] },
  { id: "distributed", title: "Distributed Systems", line: "Agreement between machines that can't see each other.", items: ["Apache Kafka", "Message queues", "Event-driven architecture", "Concurrency", "Distributed locks", "Consensus"] },
  { id: "infra", title: "Containers and Infrastructure", line: "What actually runs, and what restarts it.", items: ["Docker", "Kubernetes", "Container networking", "Service discovery", "Scaling", "Health checks"] },
  { id: "shipping", title: "Shipping Software", line: "The road from a commit to production.", items: ["Git", "GitHub Actions", "CI/CD", "Build pipelines", "Deployment strategies", "Rollbacks"] },
  { id: "ai", title: "Artificial Intelligence", line: "Models, retrieval, and systems that take actions.", items: ["How LLMs work", "Tokenisation", "Embeddings", "Vector search", "RAG", "AI agents", "Tool calling", "MCP", "Agent memory", "Multi-agent systems"] },
  { id: "web", title: "The Web", line: "The layers under every page load.", items: ["Browsers", "DNS resolution", "TCP and TLS", "HTTP requests", "Web servers", "WebSockets"] },
];

// Concept names in a collection that map to a published topic.
export const CONCEPT_LINKS = { Redis: "redis", "Apache Kafka": "kafka" };

export const topicBySlug = (slug) => TOPICS.find((t) => t.slug === slug);
export const collectionById = (id) => COLLECTIONS.find((c) => c.id === id);
