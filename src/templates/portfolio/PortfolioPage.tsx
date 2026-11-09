/* eslint-disable @next/next/no-img-element */
// The portfolio's markup, converted from the original index.html and kept
// element for element, because portfolio.css and features/portfolio target it.
import { PortfolioEffects } from "@/features/portfolio/PortfolioEffects";
import { CV_FILENAME, CV_URL, HOW_URL, JOURNEY_URL } from "@/lib/site";

// The hero name, split into masked letters that animate one at a time.
const SplitWord = ({ text, start }: { text: string; start: number }) => (
  <span className="word" data-split="" aria-hidden="true">
    {[...text].map((char, i) => (
      <span className="ch" key={i}><span className="ch__in" style={{ "--i": start + i } as React.CSSProperties}>{char}</span></span>
    ))}
  </span>
);

// The controller's level keys, in page order. Each id is a section below.
const LEVELS = [
  { id: "about", label: "About" },
  { id: "skills", label: "Skills" },
  { id: "projects", label: "Projects" },
  { id: "systems", label: "Systems" },
  { id: "founder", label: "Founder" },
  { id: "experience", label: "Experience" },
  { id: "life", label: "Life" },
  { id: "run-and-debug", label: "Run & Debug" },
  { id: "contact", label: "Contact" },
];

export const PortfolioPage = () => (
  <>

  {/* Shared icon sprite (referenced with <use href="#i-…">) */}
  <svg width="0" height="0" style={{ "position": "absolute" } as React.CSSProperties} aria-hidden="true" focusable="false">
    <defs>
      <symbol id="i-scissors" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="square">
        <g className="blade blade--a"><circle cx="6" cy="18" r="3"/><path d="M8.2 16 20 4"/></g>
        <g className="blade blade--b"><circle cx="6" cy="6" r="3"/><path d="M8.2 8 20 20"/></g>
      </symbol>
      <symbol id="i-camera" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
        <path d="M2 7h5l2-3h6l2 3h5v13H2z"/><circle className="lens" cx="12" cy="13" r="4"/><circle className="aperture" cx="12" cy="13" r="1.6" fill="currentColor" stroke="none"/>
      </symbol>
      <symbol id="i-eq" viewBox="0 0 24 24" fill="currentColor">
        <rect x="3" y="8" width="3" height="12"/><rect x="8.5" y="4" width="3" height="16"/><rect x="14" y="10" width="3" height="10"/><rect x="19.5" y="6" width="3" height="14"/>
      </symbol>
    </defs>
  </svg>
  <a href="#main" className="skip">Skip to content</a>
  <div className="progress" aria-hidden="true"><span id="progress-bar"></span></div>

  {/* ============ NAV ============ */}
  <header className="nav" id="nav">
    <a href="#top" className="nav__logo" aria-label="Ayush Oli, back to top">AO.</a>
    <button className="btn btn--icon" id="theme-toggle" aria-label="Toggle dark mode">
      <span className="theme-icon theme-icon--light">☾</span>
      <span className="theme-icon theme-icon--dark">☀</span>
    </button>
  </header>

  {/* ============ CONTROLLER (the section menu) ============
       A sidebar on desktop, a bottom bar on phones. The screen mirrors the
       active section; two round buttons: back to top, and "Click" to download the CV. */}
  <div className="pad" id="pad">
    <div className="pad__screen" aria-hidden="true">
      <span className="pad__lv">LV</span>
      <span className="pad__num" id="pad-num">00</span>
      <span className="pad__name" id="pad-name">Start</span>
      <span className="pad__xp"><i id="pad-xp"></i></span>
    </div>
    <nav className="pad__keys" id="nav-links" aria-label="Main">
      {LEVELS.map(({ id, label }, i) => (
        <a href={`#${id}`} className="pad__key" key={id}>
          <span className="pad__key-num">{String(i + 1).padStart(2, "0")}</span>{" "}
          <span className="pad__label">{label}</span>
        </a>
      ))}
    </nav>
    <div className="pad__btns">
      <a href="#top" className="gbtn gbtn--top" aria-label="Back to top">
        <span className="gbtn__face" aria-hidden="true">↑</span><span className="gbtn__label" aria-hidden="true">Top</span>
      </a>
      <a href={CV_URL} download={CV_FILENAME} className="gbtn gbtn--click" aria-label="Click: download my CV (PDF)">
        <span className="gbtn__face" aria-hidden="true"><svg viewBox="0 0 24 24" aria-hidden="true"><use href="#i-camera"/></svg></span><span className="gbtn__label" aria-hidden="true">Click</span>
      </a>
    </div>
    <button type="button" className="pad__select" id="menu-toggle" aria-label="Open menu" aria-expanded="false" aria-controls="nav-links">
      <span className="pad__select-dots" aria-hidden="true"><i></i><i></i><i></i><i></i></span>Menu
    </button>
  </div>

  <main id="main">

    {/* ============ HERO ============ */}
    <section className="hero" id="top">
      <div className="hero__grid" aria-hidden="true"></div>

      <div className="hero__inner">
        <div className="hero__tag" data-reveal="">
          <span className="flag">🇳🇵</span><span className="hero__tag-text">Nepal</span>
          <span className="arrow">→</span>
          <span className="flag">🇬🇧</span><span className="hero__tag-text">London</span>
        </div>

        <h1 className="hero__name" id="hero-name" aria-label="Ayush Oli">
          <SplitWord text="Ayush" start={0} />
          <SplitWord text="Oli" start={5} />
        </h1>

        <div className="hero__row">
          <p className="hero__headline" data-reveal=""><span className="highlight">Product Engineer</span> — AI<span className="caret" aria-hidden="true"></span></p>
          <p className="hero__sub" data-reveal="">From Nepal, based in London. I build products end to end, from architecture to <a className="hero__egg" href={JOURNEY_URL} title="Run &amp; Debug">the last pixel</a>.</p>
        </div>

        <div className="hero__actions" data-reveal="">
          <a href="#projects" className="btn btn--primary btn--fill" data-magnetic=""><span>See my work</span><span className="btn__arrow" aria-hidden="true">↓</span></a>
          <a href="#contact" className="btn btn--fill" data-magnetic=""><span>Get in touch</span><span className="btn__arrow" aria-hidden="true">→</span></a>
        </div>
      </div>

      <a href="#about" className="scroll-cue" aria-label="Scroll to about">
        <span>Scroll</span><span className="scroll-cue__line" aria-hidden="true"></span>
      </a>
    </section>

    {/* Skills ticker: decorative, pauses on hover/focus, static under reduced motion */}
    <div className="marquee" aria-hidden="true">
      <div className="marquee__track">
        <span>React ✦ Next.js ✦ TypeScript ✦ NestJS ✦ Python ✦ LLMs &amp; RAG ✦ MCP Servers ✦ Go ✦ Docker ✦ AWS ✦ </span>
        <span>React ✦ Next.js ✦ TypeScript ✦ NestJS ✦ Python ✦ LLMs &amp; RAG ✦ MCP Servers ✦ Go ✦ Docker ✦ AWS ✦ </span>
      </div>
    </div>

    {/* ============ ABOUT ============ */}
    <section id="about" className="section">
      <h2 className="section__title" data-mask=""><span><i>01</i> About</span></h2>
      <div className="about">
        <p className="about__lead" data-reveal="">
          I&apos;m an <mark>MSc Artificial Intelligence</mark> graduate and a <mark>full-stack engineer</mark>.
        </p>
        <div className="about__side" data-reveal="">
          <p>
            I work across Next.js, React, Express, NestJS, AWS, Docker and Tailwind,
            and I&apos;ve built mobile apps with Flutter.
          </p>
          <p>
            Outside of code, I&apos;m a barber<svg className="motif motif--snip" viewBox="0 0 24 24" aria-hidden="true"><use href="#i-scissors"/></svg>, a photographer<svg className="motif" viewBox="0 0 24 24" aria-hidden="true"><use href="#i-camera"/></svg> and a musician<svg className="motif" viewBox="0 0 24 24" aria-hidden="true"><use href="#i-eq"/></svg>.
          </p>
        </div>
      </div>
    </section>

    {/* ============ SKILLS ============ */}
    <section id="skills" className="section">
      <h2 className="section__title" data-mask=""><span><i>02</i> Skills</span></h2>
      <div className="skills" data-stagger="">
        <article className="skill" data-reveal="">
          <h3><span>AI / ML &amp; Data</span></h3>
          <ul>
            <li>LLMs</li><li>RAG ingestion</li><li>MCP servers</li><li>Python</li><li>LangChain</li><li>Ollama</li><li>n8n agentic workflows</li>
          </ul>
        </article>
        <article className="skill" data-reveal="">
          <h3><span>Software</span></h3>
          <ul>
            <li>React</li><li>Next.js</li><li>TypeScript</li><li>NestJS</li><li>Express</li><li>Go</li><li>GraphQL</li>
          </ul>
        </article>
        <article className="skill" data-reveal="">
          <h3><span>Cloud &amp; DevOps</span></h3>
          <ul>
            <li>AWS</li><li>GCP</li><li>Docker</li><li>GitHub Actions</li><li>Nginx</li><li>System architecture</li>
          </ul>
        </article>
        <article className="skill" data-reveal="">
          <h3><span>Databases</span></h3>
          <ul>
            <li>SQL</li><li>NoSQL</li><li>Vector DB</li><li>Serverless DB</li>
          </ul>
        </article>
      </div>
    </section>

    {/* ============ PROJECTS ============ */}
    <section id="projects" className="section">
      <h2 className="section__title" data-mask=""><span><i>03</i> Projects</span></h2>

      <div className="work">
        {/* Previews are built in HTML/CSS: swap a .preview for an <img /> once you have screenshots. */}
        <article className="project project--feature" data-reveal="">
          <div className="preview pv--accent" data-tilt="">
            <div className="preview__bar"><i></i><i></i><i></i><span>thechair.flowtiva.co.uk</span></div>
            <div className="preview__body">
              <span className="preview__num">01</span>
              <span className="preview__mark">The<br />Chair</span>
              <span className="preview__shape preview__shape--chair" aria-hidden="true"></span>
            </div>
          </div>
          <div className="project__info">
            <div className="card__head">
              <h3><a href="https://thechair.flowtiva.co.uk/" target="_blank" rel="noopener" className="project__link">The Chair<span className="project__arrow" aria-hidden="true">↗</span></a></h3>
              <span className="badge">Live</span>
            </div>
            {/* TODO: replace with your own 1–2 line description */}
            <p>A booking app for barbers. I use it to take bookings for my own cuts.</p>
            <ul className="tags tags--sm"></ul>
          </div>
        </article>

        <article className="project project--side" data-reveal="">
          <div className="preview pv--ink">
            <div className="preview__bar"><i></i><i></i><i></i><span>hairswagg.com</span></div>
            <div className="preview__body">
              <span className="preview__num">02</span>
              <span className="preview__mark">Hair<br />swagg</span>
              <span className="preview__shape preview__shape--stripes" aria-hidden="true"></span>
            </div>
          </div>
          <div className="project__info">
            <div className="card__head">
              <h3><a href="https://hairswagg.com" target="_blank" rel="noopener" className="project__link">Hairswagg<span className="project__arrow" aria-hidden="true">↗</span></a></h3>
              <span className="badge">Live</span>
            </div>
            <p>Marketing site for Hairswagg.</p>
            <ul className="tags tags--sm"></ul>
          </div>
        </article>

        <article className="project project--side" data-reveal="">
          <div className="preview pv--sun">
            <div className="preview__bar"><i></i><i></i><i></i><span>app.hairswagg.com</span></div>
            <div className="preview__body">
              <span className="preview__num">03</span>
              <span className="preview__mark">Hair<br />swagg<br />app</span>
              <span className="preview__shape preview__shape--dots" aria-hidden="true"></span>
            </div>
          </div>
          <div className="project__info">
            <div className="card__head">
              <h3><a href="https://app.hairswagg.com" target="_blank" rel="noopener" className="project__link">Hairswagg App<span className="project__arrow" aria-hidden="true">↗</span></a></h3>
              <span className="badge">Live</span>
            </div>
            <p>The web app behind Hairswagg.</p>
            <ul className="tags tags--sm"></ul>
          </div>
        </article>

        <article className="project project--feature project--flip" data-reveal="">
          <div className="preview pv--paper">
            <div className="preview__bar"><i></i><i></i><i></i><span>alls-legal.co.uk</span></div>
            <div className="preview__body">
              <span className="preview__num">04</span>
              <span className="preview__mark">Alls<br />Legal</span>
              <span className="preview__shape preview__shape--lines" aria-hidden="true"></span>
            </div>
          </div>
          <div className="project__info">
            <div className="card__head">
              <h3><a href="https://alls-legal.co.uk" target="_blank" rel="noopener" className="project__link">Alls Legal<span className="project__arrow" aria-hidden="true">↗</span></a></h3>
              <span className="badge">Live</span>
            </div>
            <p>Website for Alls Legal, a UK legal services business.</p>
            <ul className="tags tags--sm"></ul>
          </div>
        </article>

        <article className="project project--wide" data-reveal="">
          <div className="preview pv--ink">
            <div className="preview__bar"><i></i><i></i><i></i><span>flowtiva.co.uk</span></div>
            <div className="preview__body">
              <span className="preview__num">05</span>
              <span className="preview__mark">Flowtiva</span>
              <span className="preview__shape preview__shape--flow" aria-hidden="true"></span>
            </div>
          </div>
          <div className="project__info">
            <div className="card__head">
              <h3><a href="https://flowtiva.co.uk" target="_blank" rel="noopener" className="project__link">Flowtiva<span className="project__arrow" aria-hidden="true">↗</span></a></h3>
              <span className="badge">Live</span>
            </div>
            <p>Flowtiva&apos;s company site, the home of my products.</p>
            <ul className="tags tags--sm"></ul>
          </div>
        </article>
      </div>
    </section>

    {/* ============ UNDER THE HOOD (architecture playground) ============ */}
    <section id="systems" className="section">
      <h2 className="section__title" data-mask=""><span><i>04</i> Under the hood</span></h2>
      <div className="pg__intro" data-reveal="">
        <p className="pg__lead">How I think about the products I build.</p>
        <p className="pg__note">An <strong>illustrative</strong> architecture for a booking product with an AI assistant. It isn&apos;t a diagram of any specific live system, and nothing here is real traffic. Pick a component, or run a scenario.</p>
        <p className="pg__note"><a className="link" href={HOW_URL}>Go deeper: how Redis, Kafka and friends actually work ↗</a></p>
      </div>

      <div className="pg" id="playground" data-reveal="">
        <div className="pg__toolbar" role="group" aria-label="Scenarios">
          <span className="pg__label">Run a scenario</span>
          <button type="button" className="chip" data-scenario="booking">Make a booking</button>
          <button type="button" className="chip" data-scenario="payment">Take a payment</button>
          <button type="button" className="chip" data-scenario="notify">Send a reminder</button>
          <button type="button" className="chip chip--ai" data-scenario="agent">AI agent uses a tool</button>
          <button type="button" className="chip" data-scenario="failure">Fail and recover</button>
          <button type="button" className="chip chip--ghost" id="pg-reset">Reset</button>
        </div>

        <div className="pg__stage">
          <p className="pg__hint" aria-hidden="true">Swipe the diagram sideways →</p>
          <div className="pg__scroll" tabIndex={0} role="region" aria-label="Architecture diagram. Scroll sideways on small screens.">
            <div className="pg__diagram" id="pg-diagram">
              <svg className="pg__wires" id="pg-wires" aria-hidden="true">
                <defs>
                  <marker id="pg-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                    <path d="M0 0 10 5 0 10z" fill="currentColor"/>
                  </marker>
                </defs>
              </svg>

              <button type="button" className="node" data-node="client" style={{ "--c": "1", "--r": "1" } as React.CSSProperties}><span className="node__dot" aria-hidden="true"></span><span className="node__icon" aria-hidden="true">▢</span><span className="node__name">Client</span><span className="node__tip">Browser or mobile app</span></button>
              <button type="button" className="node" data-node="web" style={{ "--c": "2", "--r": "1" } as React.CSSProperties}><span className="node__dot" aria-hidden="true"></span><span className="node__icon" aria-hidden="true">&lt;/&gt;</span><span className="node__name">Frontend</span><span className="node__tip">UI, routing, form checks</span></button>
              <button type="button" className="node" data-node="api" style={{ "--c": "3", "--r": "1" } as React.CSSProperties}><span className="node__dot" aria-hidden="true"></span><span className="node__icon" aria-hidden="true">&#123; &#125;</span><span className="node__name">API</span><span className="node__tip">Business rules live here</span></button>
              <button type="button" className="node" data-node="db" style={{ "--c": "4", "--r": "1" } as React.CSSProperties}><span className="node__dot" aria-hidden="true"></span><span className="node__icon" aria-hidden="true">≡</span><span className="node__name">Database</span><span className="node__tip">Source of truth</span></button>
              <button type="button" className="node node--ai" data-node="llm" style={{ "--c": "2", "--r": "2" } as React.CSSProperties}><span className="node__dot" aria-hidden="true"></span><span className="node__icon" aria-hidden="true">✦</span><span className="node__name">AI model</span><span className="node__tip">Proposes, never executes</span></button>
              <button type="button" className="node node--ai" data-node="agent" style={{ "--c": "3", "--r": "2" } as React.CSSProperties}><span className="node__dot" aria-hidden="true"></span><span className="node__icon" aria-hidden="true">⌘</span><span className="node__name">Agent runtime</span><span className="node__tip">Validates every tool call</span></button>
              <button type="button" className="node" data-node="queue" style={{ "--c": "4", "--r": "2" } as React.CSSProperties}><span className="node__dot" aria-hidden="true"></span><span className="node__icon" aria-hidden="true">⇶</span><span className="node__name">Event queue</span><span className="node__tip">Decouples slow work</span></button>
              <button type="button" className="node node--ai" data-node="tools" style={{ "--c": "2", "--r": "3" } as React.CSSProperties}><span className="node__dot" aria-hidden="true"></span><span className="node__icon" aria-hidden="true">⚙</span><span className="node__name">Tools</span><span className="node__tip">App functions the agent may call</span></button>
              <button type="button" className="node" data-node="ext" style={{ "--c": "3", "--r": "3" } as React.CSSProperties}><span className="node__dot" aria-hidden="true"></span><span className="node__icon" aria-hidden="true">↗</span><span className="node__name">External APIs</span><span className="node__tip">Payments, email, SMS</span></button>
              <button type="button" className="node" data-node="worker" style={{ "--c": "4", "--r": "3" } as React.CSSProperties}><span className="node__dot" aria-hidden="true"></span><span className="node__icon" aria-hidden="true">↻</span><span className="node__name">Workers</span><span className="node__tip">Background jobs with retries</span></button>

              {/* The robot's home: it only ever moves inside this dock */}
              <div className="pg__dock" id="robot-dock">
                <div className="robot" id="robot">
                  <p className="robot__bubble" id="robot-bubble" aria-live="polite"></p>
                  <button type="button" className="robot__btn" id="robot-btn" aria-label="Say hello to the robot">
                    <svg className="robot__svg" viewBox="0 0 80 100" aria-hidden="true">
                      <g className="robot__body-wrap">
                        <line x1="40" y1="4" x2="40" y2="14" className="robot__stroke"/>
                        <rect x="35" y="0" width="10" height="8" className="robot__antenna"/>
                        <g className="robot__head">
                          <rect x="14" y="14" width="52" height="36" className="robot__plate"/>
                          <rect x="20" y="20" width="40" height="22" className="robot__visor"/>
                          <g className="robot__eyes">
                            <rect x="27" y="26" width="7" height="10" className="robot__eye"/>
                            <rect x="46" y="26" width="7" height="10" className="robot__eye"/>
                          </g>
                        </g>
                        <rect x="22" y="54" width="36" height="28" className="robot__plate"/>
                        <rect x="34" y="61" width="12" height="6" className="robot__light"/>
                        <g className="robot__arm robot__arm--l"><rect x="9" y="56" width="10" height="20" className="robot__plate"/></g>
                        <g className="robot__arm robot__arm--r"><rect x="61" y="56" width="10" height="20" className="robot__plate"/></g>
                        <g className="robot__leg robot__leg--l"><rect x="27" y="84" width="9" height="13" className="robot__plate"/></g>
                        <g className="robot__leg robot__leg--r"><rect x="44" y="84" width="9" height="13" className="robot__plate"/></g>
                      </g>
                    </svg>
                  </button>
                </div>
              </div>

              <ul className="pg__legend" aria-label="Legend">
                <li><span className="lg lg--wire"></span>Request path</li>
                <li><span className="lg lg--packet"></span>Data packet</li>
                <li><span className="lg lg--ai"></span>AI component</li>
                <li><span className="lg lg--err"></span>Failure, then retry</li>
              </ul>
            </div>
          </div>

          <aside className="pg__panel" id="pg-panel" aria-live="polite">
            <div className="pg__panel-head">
              <p className="pg__kicker" id="pg-kicker">Explore</p>
              <button type="button" className="pg__close" id="pg-close" aria-label="Close details" hidden>×</button>
            </div>
            <div id="pg-content">
              <h3>Pick a component</h3>
              <p>Hover or tab to a box to see what it does. Click it for the details, or run a scenario above to watch a request move through the system.</p>
            </div>
          </aside>
        </div>
      </div>
    </section>

    {/* ============ FOUNDER ============ */}
    <section id="founder" className="section">
      <h2 className="section__title" data-mask=""><span><i>05</i> Founder</span></h2>
      <div className="card timeline__item founder" data-reveal="">
        <span className="timeline__date">Present</span>
        <h3>Product Owner, Founder</h3>
        <p className="timeline__org">The Clippr apps</p>
        <ul className="timeline__list">
          <li>Founded and run The Clippr apps, owning the product from idea to launch.</li>
          <li>Set the roadmap, design the architecture and build the AI-powered features.</li>
        </ul>
      </div>
    </section>

    {/* ============ EXPERIENCE ============ */}
    <section id="experience" className="section">
      <h2 className="section__title" data-mask=""><span><i>06</i> Experience</span></h2>
      <ol className="timeline" id="timeline">
        <span className="timeline__track" aria-hidden="true"><span className="timeline__fill" id="timeline-fill"></span></span>
        <li className="card timeline__item" data-reveal="">
          <span className="timeline__date">Apr 2022 — Sep 2025</span>
          <h3>Senior Software Engineer</h3>
          <p className="timeline__org">Fusemachines Nepal · Kathmandu</p>
          <ul className="timeline__list">
            <li>Led engineering on client projects: coordinating development, reviewing pull requests and unblocking other developers.</li>
            <li>Built and maintained solutions for Broadway Licensing, TIME Magazine and OTG.</li>
            <li>Worked across the full product lifecycle, from requirements and market research to launch and post-launch support.</li>
          </ul>
        </li>
        <li className="card timeline__item" data-reveal="">
          <span className="timeline__date">Jun 2024 — Feb 2025</span>
          <h3>Software Engineer</h3>
          <p className="timeline__org">Coax · Melbourne, Australia</p>
          <ul className="timeline__list">
            <li>Built Next.js frontend features from Figma designs, with a focus on page speed, SEO and design-system consistency.</li>
            <li>Developed backend microservices in Go and Express, and integrated Facebook, Instagram, email, SMS and Twilio calling into one communications platform.</li>
            <li>Built the platform&apos;s DigitalOcean infrastructure from scratch and integrated LLM-based features.</li>
            <li>Created Workato/Ruby automations and embeddable customer plugins.</li>
          </ul>
        </li>
        <li className="card timeline__item" data-reveal="">
          <span className="timeline__date">Apr 2021 — Apr 2022</span>
          <h3>Software Engineer</h3>
          <p className="timeline__org">Hazesoft · Kathmandu</p>
          <ul className="timeline__list">
            <li>Built full-stack apps with Next.js, Express and Laravel.</li>
            <li>Owned the KeplerCloud project for a Swedish client and contributed to HDL Ecommerce.</li>
            <li>Managed deployments and CI/CD with GitLab.</li>
          </ul>
        </li>
        <li className="card timeline__item" data-reveal="">
          <span className="timeline__date">Aug 2019 — Dec 2020</span>
          <h3>Full Stack Developer</h3>
          <p className="timeline__org">Diprung Technologies · Kathmandu</p>
          <ul className="timeline__list">
            <li>Shipped 2 Flutter/Kotlin mobile apps to production with 4.2+ Play Store ratings.</li>
            <li>Built Laravel and Vue.js products end to end, from requirements to deployment.</li>
          </ul>
        </li>
      </ol>

      <h3 className="subhead" data-reveal="">Education</h3>
      <div className="timeline timeline--plain">
        <div className="card timeline__item" data-reveal="">
          <span className="timeline__date">2025 — 2026</span>
          <h3>MSc Artificial Intelligence Technology</h3>
          <p className="timeline__org">Northumbria University, London</p>
        </div>
        <div className="card timeline__item" data-reveal="">
          <span className="timeline__date">2017 — 2024</span>
          <h3>BSc Information Technology</h3>
          <p className="timeline__org">ISMT College, Kathmandu (University of Sunderland)</p>
        </div>
      </div>
    </section>

    {/* ============ LIFE OUTSIDE TECH ============ */}
    <section id="life" className="section">
      <h2 className="section__title" data-mask=""><span><i>07</i> Outside tech</span></h2>

      <div className="grid grid--3" data-stagger="">
        <article className="card card--life" data-reveal="">
          <span className="card__icon card__icon--pole"><svg className="icon icon--snip" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="square" aria-hidden="true"><g className="blade blade--a"><circle cx="6" cy="18" r="3"/><path d="M8.2 16 20 4"/></g><g className="blade blade--b"><circle cx="6" cy="6" r="3"/><path d="M8.2 8 20 20"/></g></svg></span>
          <h3>Barbering</h3>
          <p>I&apos;m a self-taught professional barber. I take bookings through my own app.</p>
          <a href="https://thechair.flowtiva.co.uk/" target="_blank" rel="noopener" className="link">Book a cut ↗</a>
        </article>

        <article className="card card--life" data-reveal="">
          <span className="card__icon"><svg className="icon icon--shutter" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true"><path d="M2 7h5l2-3h6l2 3h5v13H2z"/><circle cx="12" cy="13" r="4"/><circle className="aperture" cx="12" cy="13" r="1.6" fill="currentColor" stroke="none"/></svg></span>
          <h3>Photography</h3>
          <p>Street, landscape and vintage, shot around London and Nepal.</p>
          <a href="#gallery" className="link">See photos ↓</a>
        </article>

        <article className="card card--life" data-reveal="">
          <span className="card__icon"><svg className="icon icon--eq" viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="8" width="3" height="12"/><rect x="8.5" y="4" width="3" height="16"/><rect x="14" y="10" width="3" height="10"/><rect x="19.5" y="6" width="3" height="14"/></svg></span>
          <h3>Music</h3>
          <p>I play guitar and sing.</p>
        </article>
      </div>

      {/* Photo gallery
           To add a photo: put the file in /images and add
           <figure className="photo" data-reveal="mask"><img src="/images/your-photo.jpg" alt="Describe the photo" loading="lazy" /></figure>
      */}
      <div id="gallery" className="gallery">
        <figure className="photo" data-reveal="mask"><img src="/images/web/photo1.jpg" alt="Photograph 1" width="1200" height="1600" loading="lazy" /></figure>
        <figure className="photo" data-reveal="mask"><img src="/images/web/photo2.jpg" alt="Photograph 2" width="1200" height="1600" loading="lazy" /></figure>
        <figure className="photo" data-reveal="mask"><img src="/images/web/photo3.jpg" alt="Photograph 3" width="1200" height="1600" loading="lazy" /></figure>
        <figure className="photo" data-reveal="mask"><img src="/images/web/photo4.jpg" alt="Photograph 4" width="1200" height="1584" loading="lazy" /></figure>
        <figure className="photo" data-reveal="mask"><img src="/images/web/photo5.jpg" alt="Photograph 5" width="1181" height="1600" loading="lazy" /></figure>
        <figure className="photo" data-reveal="mask"><img src="/images/web/photo6.jpg" alt="Photograph 6" width="1200" height="1600" loading="lazy" /></figure>
        <figure className="photo" data-reveal="mask"><img src="/images/web/photo7.jpg" alt="Photograph 7" width="1200" height="1600" loading="lazy" /></figure>
        <figure className="photo" data-reveal="mask"><img src="/images/web/photo8.jpg" alt="Photograph 8" width="1200" height="1586" loading="lazy" /></figure>
      </div>
    </section>

    {/* ============ RUN & DEBUG ============ */}
    <section id="run-and-debug" className="section">
      <h2 className="section__title" data-mask=""><span><i>08</i> Run &amp; Debug</span></h2>
      <div className="grid grid--split" data-stagger="">
        <article className="card card--life" data-reveal="">
          <h3>How Things Work</h3>
          <p>Interactive simulations of how Redis, Kafka and the systems behind modern software actually work.</p>
          <a href={HOW_URL} className="link">Read it →</a>
        </article>
        {/* One third wide, and deliberately untitled */}
        <article className="card card--life card--small" data-reveal="" aria-label="My Journey">
          <p>A growing collection of things I&apos;m building, learning, seeing and figuring out along the way.</p>
          <a href={JOURNEY_URL} className="link">My journey →</a>
        </article>
      </div>
    </section>

    {/* ============ CONTACT ============ */}
    <section id="contact" className="section contact">
      <h2 className="section__title" data-mask=""><span><i>09</i> Contact</span></h2>
      <p className="contact__big" data-reveal="">Want to build<br />something <em>together?</em></p>
      <p className="contact__lead" data-reveal="">Say hi.</p>
      <div className="contact__email" data-reveal="">
        <a href="mailto:hello@ayush.oli.com.np" className="btn btn--primary btn--lg btn--fill" data-magnetic=""><span>hello@ayush.oli.com.np</span><span className="btn__arrow" aria-hidden="true">→</span></a>
        <button type="button" className="btn btn--fill copy" id="copy-email" data-copy="hello@ayush.oli.com.np"><span className="copy__label">Copy</span></button>
        <span className="copy__status" id="copy-status" role="status"></span>
      </div>
      <div className="contact__links" data-reveal="">
        <a href="https://github.com/ayusholi" target="_blank" rel="noopener" className="btn btn--fill" data-magnetic=""><span>GitHub</span><span className="btn__arrow" aria-hidden="true">↗</span></a>
        <a href="https://www.linkedin.com/in/ayush-o-368a13142" target="_blank" rel="noopener" className="btn btn--fill" data-magnetic=""><span>LinkedIn</span><span className="btn__arrow" aria-hidden="true">↗</span></a>
      </div>
    </section>

  </main>

  <footer className="footer">
    <p>© <span id="year"></span> Ayush Oli · Nepal → London</p>
    <p className="footer__note"><span className="status-dot" aria-hidden="true"></span> Hand-built: HTML, CSS and a little JS <svg className="motif motif--eq" viewBox="0 0 24 24" aria-hidden="true"><use href="#i-eq"/></svg></p>
    <a href="#top" className="footer__top">Back to top ↑</a>
  </footer>

  
    <PortfolioEffects />
  </>
);
