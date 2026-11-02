import type { Collection } from "./content-types";

const concepts = (...names: string[]) => names.map((name) => ({ name }));

export const COLLECTIONS: Collection[] = [
  { id: "request", title: "The Request Journey", line: "From a typed address to a response.", concepts: concepts("DNS", "HTTP", "Reverse proxies", "Nginx", "Load balancing", "APIs") },
  { id: "memory", title: "Memory and Data", line: "Where state lives, and how it stays true.", concepts: [{ name: "Redis", topic: "redis" }, ...concepts("PostgreSQL", "Database indexes", "Transactions", "Connection pooling", "Database replication")] },
  { id: "distributed", title: "Distributed Systems", line: "Agreement between machines that can't see each other.", concepts: [{ name: "Apache Kafka", topic: "apache-kafka" }, ...concepts("Message queues", "Event-driven architecture", "Concurrency", "Distributed locks", "Consensus")] },
  { id: "infra", title: "Containers and Infrastructure", line: "What actually runs, and what restarts it.", concepts: [{ name: "Docker", topic: "docker" }, { name: "Kubernetes", topic: "kubernetes" }, ...concepts("Container networking", "Service discovery", "Scaling", "Health checks")] },
  { id: "shipping", title: "Shipping Software", line: "The road from a commit to production.", concepts: [...concepts("Git"), { name: "GitHub Actions", topic: "github-actions" }, { name: "CI/CD", topic: "ci-cd" }, ...concepts("Build pipelines", "Deployment strategies", "Rollbacks")] },
  { id: "ai", title: "Artificial Intelligence", line: "Models, retrieval, and systems that take actions.", concepts: concepts("How LLMs work", "Tokenisation", "Embeddings", "Vector search", "RAG", "AI agents", "Tool calling", "MCP", "Agent memory", "Multi-agent systems") },
  { id: "web", title: "The Web", line: "The layers under every page load.", concepts: concepts("Browsers", "DNS resolution", "TCP and TLS", "HTTP requests", "Web servers", "WebSockets") },
];
