// Everything AYUSH.OS says about Ayush. This file is the source of truth: edit
// facts here, and every window, the stack map and the terminal follow.
//
// Rule for editors: only state what's verified. Where a detail is unknown,
// leave the field out rather than filling it in. Fields marked EDIT are ones
// waiting for details.
import type { Discovery, LogEntry, Phase, Product, Project, Role, Tech, TechLink } from "./os-types";

export const IDENTITY = {
  system: "AYUSH.OS",
  name: "Ayush Oli",
  titles: ["Senior Software Engineer", "Technical Leader", "Product Builder"],
  intro: "Building software, leading engineering teams and turning ideas into products.",
  location: "London, UK",
  origin: "From Nepal",
  current: "Building Apostro",
  email: "hello@ayush.oli.com.np",
  github: "https://github.com/ayusholi",
  linkedin: "https://www.linkedin.com/in/ayush-o-368a13142",
  careerStart: { y: 2017, m: 6 },
};

// The desktop's "start here" list: the strongest stories, one click away.
export const FEATURED = [
  { app: "projects", id: "broadway", title: "Broadway Licensing", line: "Led delivery: ~6 months of expected work in 2" },
  { app: "projects", id: "excitation", title: "Excitation", line: "Go microservices, notifications, scheduling, infra" },
  { app: "projects", id: "timepieces", title: "TIMEPieces", line: "Solidity contracts, validated on remote testnets" },
  { app: "founder", id: "apostro", title: "Apostro", line: "A Law Firm Operating System, built independently" },
] as const;

// ---------- Career ----------

export const PHASES: Phase[] = [
  { id: "web", label: "Web foundations", summary: "Search optimisation, then full-stack and mobile development.", start: { y: 2017, m: 6 }, end: { y: 2020, m: 11 } },
  { id: "product", label: "Full-stack product engineering", summary: "Laravel, React, Next.js and Express products, plus the CI/CD and deployment behind them.", start: { y: 2020, m: 12 }, end: { y: 2022, m: 3 } },
  { id: "lead", label: "Complex systems & leadership", summary: "TIME, Broadway Licensing and Excitation, then leading an 18–22-engineer team from December 2024.", start: { y: 2022, m: 4 }, end: { y: 2025, m: 8 } },
  { id: "ai", label: "AI & independent products", summary: "An MSc in AI in London, and building Apostro and TheClippr.", start: { y: 2025, m: 9 }, end: { y: 2026, m: 11 } },
];

export const ROLES: Role[] = [
  {
    id: "sbweb", short: "S.B. Web", org: "S.B. Web Technology", kind: "main",
    titles: [{ title: "Search Engine Optimization Analyst", start: { y: 2017, m: 6 }, end: { y: 2018, m: 8 } }],
    start: { y: 2017, m: 6 }, end: { y: 2018, m: 8 },
    summary: "Where it started: search engine optimisation and how the web gets found.",
    points: ["Search Engine Optimization Analyst."],
  },
  {
    id: "greenivy", short: "Green Ivy", org: "Green Ivy Technology", kind: "main",
    titles: [{ title: "Full-stack Developer", start: { y: 2018, m: 10 }, end: { y: 2019, m: 8 } }],
    start: { y: 2018, m: 10 }, end: { y: 2019, m: 8 },
    summary: "The move from optimising websites to building them.",
    points: ["Full-stack Developer."],
  },
  {
    id: "diprung", short: "Diprung", org: "Diprung Technology", kind: "main", location: "Kathmandu",
    titles: [{ title: "Web & Mobile Developer", start: { y: 2019, m: 8 }, end: { y: 2020, m: 11 } }],
    start: { y: 2019, m: 8 }, end: { y: 2020, m: 11 },
    summary: "Early full-stack and mobile development experience.",
    points: ["Web and mobile development with PHP, JavaScript, Vue.js and Flutter."],
  },
  {
    id: "supreme", short: "Supreme IT", org: "Supreme IT Solutions", kind: "side",
    titles: [{ title: "Software Engineer", start: { y: 2020, m: 11 }, end: { y: 2021, m: 4 } }],
    start: { y: 2020, m: 11 }, end: { y: 2021, m: 4 },
    summary: "Software Engineer.",
    points: [],
  },
  {
    id: "hazesoft", short: "Hazesoft", org: "Hazesoft Pvt. Ltd.", kind: "main", location: "Kathmandu",
    titles: [{ title: "Software Engineer", start: { y: 2021, m: 4 }, end: { y: 2022, m: 4 } }],
    start: { y: 2021, m: 4 }, end: { y: 2022, m: 4 },
    summary: "Full-stack product work, plus the infrastructure that ships it.",
    points: [
      "Laravel, React, Next.js and Express.",
      "Independently handled KeplerCloud, managed WordPress hosting for a Swedish client.",
      "Contributed to HDL Ecommerce.",
      "Backend development, infrastructure, CI/CD, containers and deployment.",
      "Ansible, Jenkins and GitLab CI/CD.",
    ],
    projects: ["keplercloud", "hdl"],
  },
  {
    id: "criarme", short: "Criarme", org: "Criarme Soft", kind: "side",
    titles: [{ title: "Freelance Full Stack Engineer", start: { y: 2021, m: 8 }, end: { y: 2022, m: 5 } }],
    start: { y: 2021, m: 8 }, end: { y: 2022, m: 5 },
    summary: "Freelance Full Stack Engineer.",
    points: [],
  },
  {
    id: "fusemachines", org: "Fusemachines", kind: "main", location: "Kathmandu",
    titles: [
      { title: "Software Engineer", start: { y: 2022, m: 4 }, end: { y: 2022, m: 12 } },
      { title: "Senior Software Engineer", start: { y: 2023, m: 1 }, end: { y: 2025, m: 9 } },
    ],
    start: { y: 2022, m: 4 }, end: { y: 2025, m: 9 },
    summary: "Client products for TIME, Galaxy Entertainment and Broadway Licensing, then engineering leadership.",
    points: [
      "Worked across TIME Magazine, TIME.com, Galaxy Entertainment, Broadway Licensing and internal products.",
      "Led engineering projects, mentored developers and coordinated technical delivery.",
      "From December 2024: full-stack engineering leadership and people management across an 18–22-engineer team.",
    ],
    projects: ["timepieces", "timecom", "galaxy", "broadway", "squadery"],
  },
  {
    id: "excitation", org: "Excitation", kind: "parallel", location: "Remote · Australia",
    titles: [{ title: "Full Stack Engineer (Contract)", start: { y: 2024, m: 5 }, end: { y: 2025, m: 2 } }],
    start: { y: 2024, m: 5 }, end: { y: 2025, m: 2 },
    summary: "An all-in-one communications platform for Australian small and medium-sized businesses.",
    points: [
      "Next.js frontend features from Figma designs.",
      "Go and Express microservices: notification, scheduling and automation modules.",
      "Twilio integration, Workato and Ruby automations, embeddable website plugins.",
      "Built the DigitalOcean infrastructure from scratch.",
    ],
    projects: ["excitation"],
    note: "A parallel contract alongside Fusemachines (previously listed as Coax).",
  },
  {
    id: "transition", short: "MSc AI · London", org: "London · Northumbria University", kind: "transition", location: "London",
    titles: [{ title: "Career transition & relocation", start: { y: 2025, m: 9 }, end: { y: 2026, m: 7 } }],
    start: { y: 2025, m: 9 }, end: { y: 2026, m: 7 },
    summary: "Relocated to London for an MSc in Artificial Intelligence.",
    points: [
      "MSc Artificial Intelligence, Northumbria University.",
      "Continued independent product development and applied AI work.",
    ],
    note: "A career transition, not an employment role.",
  },
  {
    id: "hb", short: "H&B", org: "Holland & Barrett", kind: "side", location: "London",
    titles: [{ title: "Supervisor", start: { y: 2026, m: 8 }, end: { y: 2026, m: 11 } }],
    start: { y: 2026, m: 8 }, end: { y: 2026, m: 11 },
    summary: "Supervisor.",
    points: [],
  },
];

// ---------- Projects ----------

export const PROJECTS: Project[] = [
  {
    id: "broadway", name: "Broadway Licensing", client: "Broadway Licensing", roleId: "fusemachines",
    role: "Project Lead / Technical Lead", kind: "case-study",
    summary: "Inherited a partially built system with limited documentation, and roughly six months of expected work to finish in two.",
    contributions: [
      "Took ownership of the project.",
      "Helped select team members.",
      "Trained and mentored developers.",
      "Led technical delivery and coordinated development and priorities.",
    ],
    challenge: "A partially developed system, limited documentation, and around six months of expected work due in two months.",
    solution: "Took ownership end to end: shaped the team, brought developers up to speed, and ran delivery and priorities directly.",
    outcome: ["Delivered under the deadline.", "Strong client satisfaction."],
    logId: "eng-003",
    links: [{ label: "concordtheatricals.com", href: "https://www.concordtheatricals.com/" }],
  },
  {
    id: "excitation", name: "Excitation", client: "Australian communications platform", roleId: "excitation",
    role: "Contract Full Stack Engineer", kind: "case-study",
    summary: "An all-in-one communications platform for SMBs in Australia: Facebook, Instagram, SMS, email, phone calls, contact forms and third-party integrations, with customer communication workflows.",
    contributions: [
      "Next.js frontend features from Figma designs.",
      "Go and Express microservices.",
      "Notification, scheduling and automation modules.",
      "Twilio integration.",
      "Workflow automations with Workato and Ruby.",
      "Embeddable website plugins.",
      "DigitalOcean infrastructure, built from scratch.",
    ],
    notes: ["Core experience: Go concurrency, microservices, message brokers, distributed systems, notifications and scheduling, infrastructure and deployments."],
    logId: "eng-004",
    links: [{ label: "coax.com.au", href: "https://coax.com.au" }],
  },
  {
    id: "timepieces", name: "TIMEPieces", client: "TIME Magazine", roleId: "fusemachines",
    role: "Full-stack Engineer", kind: "case-study",
    summary: "TIME's NFT project. Product design and implementation across frontend, backend and smart contracts.",
    contributions: [
      "Product design and implementation.",
      "Frontend development and integration.",
      "Backend implementation.",
      "NFT smart contract development in Solidity, and Web3 integration.",
    ],
    challenge: "Testing Solidity contracts and NFT functionality from Nepal, where regulatory restrictions on cryptocurrency made local testing difficult.",
    solution: "Used remote testnet infrastructure to deploy and validate the smart contracts.",
    outcome: ["Launched. One engineer stayed on for maintenance and support; the rest of the team moved on to TIME.com."],
    notes: ["TIME's wider Web3 business reported significant commercial success. That isn't a TIMEPieces-specific figure."],
    logId: "eng-001",
    links: [{ label: "nft.time.com", href: "https://nft.time.com" }],
  },
  {
    id: "timecom", name: "TIME.com", client: "TIME", roleId: "fusemachines",
    role: "Software Engineer", kind: "case-study",
    summary: "Platform modernisation: moving TIME.com from a legacy stack to Next.js and NestJS, one component at a time.",
    contributions: [
      "Started on smaller components with Handlebars and Express.",
      "After about three months the direction moved to Next.js and NestJS; contributed to the migration and the incremental deployment of new components.",
      "Took on migrating legacy WordPress/PHP pages.",
      "Built a conversion tool: legacy PHP-rendered pages to HTML, then adapted into the new Next.js templating structure.",
    ],
    logId: "eng-002",
    links: [{ label: "time.com", href: "https://time.com" }],
  },
  {
    id: "squadery", name: "Squadery.com", client: "Squadery", roleId: "fusemachines",
    role: "Senior Engineer & Architect", kind: "entry",
    summary: "A four-month engagement at Fusemachines.",
    contributions: ["Architecture.", "Technical decisions.", "Hands-on engineering.", "Technical leadership."],
  },
  {
    id: "galaxy", name: "Galaxy Entertainment", client: "Galaxy Entertainment", roleId: "fusemachines",
    role: "Software Engineer", kind: "entry",
    summary: "A project engagement that followed TIMEPieces.",
    contributions: [],
  },
  {
    id: "keplercloud", name: "KeplerCloud", client: "Swedish client", roleId: "hazesoft",
    role: "Software Engineer · handled independently", kind: "entry",
    summary: "Managed WordPress hosting for a Swedish client.",
    contributions: ["Independently handled development and maintenance of the application."],
    links: [{ label: "keplercloud.se", href: "https://keplercloud.se/" }],
  },
  {
    id: "hdl", name: "HDL Ecommerce", client: "HDL", roleId: "hazesoft",
    role: "Software Engineer", kind: "entry",
    summary: "A React and Laravel ecommerce project.",
    contributions: ["Frontend and backend implementation, as part of a development team."],
    links: [{ label: "hdlcommerce.com", href: "https://hdlcommerce.com/" }],
  },
];

// ---------- Stack ----------

export const TECH: Tech[] = [
  { id: "javascript", name: "JavaScript", group: "Languages" },
  { id: "typescript", name: "TypeScript", group: "Languages" },
  { id: "php", name: "PHP", group: "Languages" },
  { id: "python", name: "Python", group: "Languages" },
  { id: "go", name: "Go", group: "Languages" },
  { id: "ruby", name: "Ruby", group: "Languages" },
  { id: "solidity", name: "Solidity", group: "Languages" },

  { id: "react", name: "React", group: "Frontend" },
  { id: "nextjs", name: "Next.js", group: "Frontend" },
  { id: "vue", name: "Vue.js", group: "Frontend" },
  { id: "flutter", name: "Flutter", group: "Frontend" },
  { id: "handlebars", name: "Handlebars", group: "Frontend" },

  { id: "nodejs", name: "Node.js", group: "Backend" },
  { id: "express", name: "Express", group: "Backend" },
  { id: "nestjs", name: "NestJS", group: "Backend" },
  { id: "laravel", name: "Laravel", group: "Backend" },

  { id: "docker", name: "Docker", group: "Infrastructure", explainer: "docker" },
  { id: "kubernetes", name: "Kubernetes", group: "Infrastructure", explainer: "kubernetes" },
  { id: "nginx", name: "Nginx", group: "Infrastructure", explainer: "nginx" },
  { id: "aws", name: "AWS", group: "Infrastructure" },
  { id: "azure", name: "Microsoft Azure", group: "Infrastructure" },
  { id: "digitalocean", name: "DigitalOcean", group: "Infrastructure" },
  { id: "ansible", name: "Ansible", group: "Infrastructure" },
  { id: "jenkins", name: "Jenkins", group: "Infrastructure", explainer: "ci-cd" },
  { id: "gitlab", name: "GitLab CI/CD", group: "Infrastructure", explainer: "ci-cd" },

  { id: "postgres", name: "PostgreSQL", group: "Data & messaging", explainer: "databases" },
  { id: "mongodb", name: "MongoDB", group: "Data & messaging", explainer: "databases" },
  { id: "sqlserver", name: "SQL Server", group: "Data & messaging", explainer: "databases" },
  { id: "redis", name: "Redis", group: "Data & messaging", explainer: "redis" },
  { id: "rabbitmq", name: "RabbitMQ", group: "Data & messaging" },
  { id: "kafka", name: "Kafka", group: "Data & messaging", explainer: "apache-kafka" },
  { id: "elasticsearch", name: "Elasticsearch", group: "Data & messaging" },

  { id: "ethereum", name: "Ethereum", group: "Platforms & services" },
  { id: "web3", name: "Web3", group: "Platforms & services" },
  { id: "shopify", name: "Shopify", group: "Platforms & services" },
  { id: "wordpress", name: "WordPress", group: "Platforms & services" },
  { id: "twilio", name: "Twilio", group: "Platforms & services" },
  { id: "workato", name: "Workato", group: "Platforms & services" },

  { id: "agentic", name: "Agentic AI", group: "AI", explainer: "ai-agents" },
  { id: "rag", name: "RAG", group: "AI", explainer: "rag" },
  { id: "graphrag", name: "GraphRAG", group: "AI" },
  { id: "mcp", name: "MCP", group: "AI", explainer: "mcp" },
  { id: "langchain", name: "LangChain", group: "AI" },
  { id: "aiautomation", name: "AI automation", group: "AI", explainer: "ai-automations" },
  { id: "n8n", name: "n8n", group: "AI" },
  { id: "claude", name: "Claude", group: "AI" },
];

export const TECH_GROUPS = ["Languages", "Frontend", "Backend", "Infrastructure", "Data & messaging", "Platforms & services", "AI"] as const;

// Each link is a stated fact. A technology with no links shows as toolkit,
// not tied to a featured project yet. EDIT: add links as they're confirmed.
export const TECH_LINKS: TechLink[] = [
  // Diprung
  ...["php", "javascript", "vue", "flutter"].map((tech) => ({ tech, target: "diprung", note: "Web and mobile development" })),
  // Hazesoft
  { tech: "laravel", target: "hazesoft", note: "Full-stack applications" },
  { tech: "react", target: "hazesoft", note: "Full-stack applications" },
  { tech: "nextjs", target: "hazesoft", note: "Full-stack applications" },
  { tech: "express", target: "hazesoft", note: "Full-stack applications" },
  { tech: "docker", target: "hazesoft", note: "Containers and deployment" },
  { tech: "ansible", target: "hazesoft", note: "Infrastructure and deployment" },
  { tech: "jenkins", target: "hazesoft", note: "CI/CD" },
  { tech: "gitlab", target: "hazesoft", note: "CI/CD" },
  // TIMEPieces
  { tech: "nextjs", target: "timepieces", note: "Frontend" },
  { tech: "react", target: "timepieces", note: "Frontend" },
  { tech: "nodejs", target: "timepieces", note: "Backend" },
  { tech: "express", target: "timepieces", note: "Backend" },
  { tech: "aws", target: "timepieces", note: "AWS Lambda" },
  { tech: "solidity", target: "timepieces", note: "NFT smart contracts" },
  { tech: "ethereum", target: "timepieces", note: "Contracts deployed and validated on remote testnets" },
  { tech: "web3", target: "timepieces", note: "Web3 integration" },
  // TIME.com
  { tech: "handlebars", target: "timecom", note: "Early components, before the migration" },
  { tech: "express", target: "timecom", note: "Early components, before the migration" },
  { tech: "nextjs", target: "timecom", note: "The new platform's frontend" },
  { tech: "nestjs", target: "timecom", note: "The new platform's backend" },
  { tech: "php", target: "timecom", note: "Legacy pages, converted by a custom tool" },
  { tech: "wordpress", target: "timecom", note: "Legacy pages migrated off WordPress" },
  // Broadway Licensing
  { tech: "nextjs", target: "broadway", note: "Frontend" },
  { tech: "express", target: "broadway", note: "Backend" },
  { tech: "shopify", target: "broadway", note: "Commerce" },
  { tech: "sqlserver", target: "broadway", note: "Database" },
  { tech: "azure", target: "broadway", note: "Cloud" },
  { tech: "jenkins", target: "broadway", note: "CI/CD" },
  // Excitation
  { tech: "nextjs", target: "excitation", note: "Frontend features from Figma designs" },
  { tech: "go", target: "excitation", note: "Microservices and concurrency" },
  { tech: "express", target: "excitation", note: "Microservices" },
  { tech: "rabbitmq", target: "excitation", note: "Message broker" },
  { tech: "digitalocean", target: "excitation", note: "Infrastructure built from scratch" },
  { tech: "nginx", target: "excitation", note: "Part of the DigitalOcean infrastructure" },
  { tech: "twilio", target: "excitation", note: "Twilio integration" },
  { tech: "workato", target: "excitation", note: "Workflow automations" },
  { tech: "ruby", target: "excitation", note: "Workato automations" },
  // The rest
  { tech: "nextjs", target: "squadery", note: "Frontend" },
  { tech: "react", target: "galaxy", note: "Frontend" },
  { tech: "express", target: "galaxy", note: "Backend" },
  { tech: "react", target: "keplercloud", note: "Frontend" },
  { tech: "express", target: "keplercloud", note: "Backend" },
  { tech: "wordpress", target: "keplercloud", note: "The managed hosting product" },
  { tech: "react", target: "hdl", note: "Frontend" },
  { tech: "laravel", target: "hdl", note: "Backend" },
  { tech: "php", target: "hdl", note: "Laravel backend" },
];

// ---------- Engineering log ----------

export const LOG: LogEntry[] = [
  {
    id: "eng-001", title: "Testing smart contracts under regional restrictions", system: "TIMEPieces",
    type: "constraint", status: "resolved", projectId: "timepieces",
    summary: "NFT contracts had to be tested from a country where crypto restrictions made local testing difficult.",
    context: ["TIMEPieces needed Solidity smart contracts and NFT functionality, built and tested by an engineering team in Nepal."],
    constraints: ["Cryptocurrency-related regulatory restrictions in Nepal made local testing difficult."],
    approach: ["Used remote testnet infrastructure to deploy and validate the smart contracts."],
    outcome: ["Contracts validated and the project launched."],
  },
  {
    id: "eng-002", title: "Migrating legacy WordPress/PHP pages to Next.js", system: "TIME.com",
    type: "migration", status: "resolved", projectId: "timecom",
    summary: "Legacy PHP-rendered pages needed a path into the new Next.js templating structure.",
    context: [
      "TIME.com work started on small components in Handlebars and Express.",
      "About three months in, the engineering direction moved to Next.js and NestJS, with new components deployed incrementally.",
    ],
    approach: [
      "Took on the migration of legacy WordPress/PHP pages personally.",
      "Built a custom conversion tool: render the legacy PHP page to HTML, then adapt that HTML into the new templating structure for Next.js.",
    ],
    outcome: ["Legacy pages migrated into the new Next.js platform."],
  },
  {
    id: "eng-003", title: "Six months of scope, two months of calendar", system: "Broadway Licensing",
    type: "delivery", status: "resolved", projectId: "broadway",
    summary: "An inherited, partially built system with limited documentation and a deadline a third of the expected effort.",
    context: ["Inherited a partially developed system with limited documentation."],
    constraints: ["About six months of expected work had to be completed in two months."],
    approach: [
      "Took ownership of the project.",
      "Helped select team members.",
      "Trained and mentored developers.",
      "Led technical delivery and coordinated development and priorities.",
    ],
    outcome: ["Delivered under the deadline.", "Strong client satisfaction."],
  },
  {
    id: "eng-004", title: "Notifications, scheduling and automation in Go", system: "Excitation",
    type: "architecture", status: "documented", projectId: "excitation", diagram: "excitation",
    summary: "The service work behind a platform that unifies business messaging across channels.",
    context: ["One platform for Facebook, Instagram, SMS, email, phone calls, contact forms and third-party integrations, with customer communication workflows."],
    approach: [
      "Built microservices in Go and Express.",
      "Built the notification, scheduling and automation modules.",
      "Integrated Twilio; built workflow automations with Workato and Ruby.",
      "Worked with Go concurrency, message brokers (RabbitMQ) and distributed systems.",
    ],
  },
  {
    id: "eng-005", title: "Infrastructure and deployment, twice from the ground up", system: "Hazesoft · Excitation",
    type: "infrastructure", status: "documented",
    summary: "Owning how software ships, not only how it's written.",
    context: [
      "Hazesoft: backend development, infrastructure, CI/CD, containers and deployment.",
      "Excitation: the platform needed infrastructure from nothing.",
    ],
    approach: [
      "Hazesoft: deployment and CI/CD with Ansible, Jenkins and GitLab CI/CD.",
      "Excitation: built the DigitalOcean infrastructure from scratch, with Nginx.",
    ],
  },
];

// ---------- Founder mode ----------

export const PRODUCTS: Product[] = [
  {
    id: "apostro", name: "Apostro", flagship: true, evolvedFrom: "allslegal",
    tagline: "A modern, affordable Law Firm Operating System.",
    status: "Current flagship",
    description: "An all-in-one CRM and operating system for small solicitor firms and lawyers.",
    features: ["Firm management", "Client management", "Matters & case workflows", "Tasks", "RBAC", "Firm onboarding & invitations", "Audit trails", "AI-integrated tools"],
    architecture: ["Multi-tenant architecture"],
  },
  {
    id: "allslegal", name: "ALLS Legal",
    tagline: "Where Apostro started.",
    status: "Evolved into Apostro",
    description: "A solicitor firm's website and appointment-booking experience.",
    features: ["Firm website", "Appointment booking"],
    url: "https://alls-legal.co.uk",
  },
  {
    id: "theclippr", name: "TheClippr",
    tagline: "Multi-tenant SaaS for barbershops and salons.",
    status: "Independent product",
    description: "A barbershop and salon management platform.",
    features: ["Appointments", "Payments", "Payouts", "Expenses", "Business management", "A branded website for each shop"],
    architecture: ["Multi-tenant SaaS"],
  },
];

// ---------- Discoveries ----------
// Unlocked by exploring. Each one is a real accomplishment, or an Easter egg (marked).

export const DISCOVERIES: Discovery[] = [
  { id: "deadline", title: "Six months in two", detail: "Broadway Licensing: led delivery of ~6 months of expected work in 2.", hint: "Open the Broadway Licensing case study." },
  { id: "lead", title: "18–22 engineers", detail: "Full-stack engineering leadership and people management at Fusemachines from December 2024.", hint: "Read the Fusemachines chapter." },
  { id: "testnet", title: "Testnet workaround", detail: "TIMEPieces: deployed and validated contracts on remote testnets when local testing wasn't an option.", hint: "Open TIMEPieces, or its log entry." },
  { id: "converter", title: "Legacy, converted", detail: "TIME.com: built a tool to turn legacy PHP pages into Next.js templates.", hint: "Look into the TIME.com migration." },
  { id: "infra", title: "Infrastructure from zero", detail: "Excitation: DigitalOcean infrastructure built from scratch.", hint: "Open the Excitation case study." },
  { id: "founder", title: "From website to platform", detail: "ALLS Legal grew into Apostro, a law firm operating system.", hint: "Open Apostro in FOUNDER.MODE." },
  { id: "sidequests", title: "Off the main path", detail: "Found the side quests in the career timeline.", hint: "The career timeline hides a few things." },
  { id: "terminal", title: "Shell access", detail: "Ran a command in the terminal.", hint: "Developers might prefer a terminal.", egg: true },
  { id: "hire", title: "sudo hire ayush", detail: "Permission granted.", hint: "Some commands need elevated privileges.", egg: true },
  { id: "konami", title: "No cheat codes", detail: "↑↑↓↓←→←→BA. Everything here was earned the long way.", hint: "A very old code still does something.", egg: true },
];
