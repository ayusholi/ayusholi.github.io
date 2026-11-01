/* eslint-disable @next/next/no-img-element, @next/next/no-html-link-for-pages -- these links cross root layouts */
// The Scrapbook's markup, converted from the original blog.html and kept
// element for element, because its styles and effects target it.
import { ScrapbookEffects } from "@/features/scrapbook/ScrapbookEffects";

export const ScrapbookPage = () => (
  <>

  <a className="skip" href="#main">Skip to content</a>

  {/* ============ A. NAVIGATION ============ */}
  <header className="masthead">
    <div className="masthead__inner wrap">
      <a className="wordmark" href="#top" aria-label="The Scrapbook, home">
        <span className="wordmark__title"><em>The</em> Scrapbook</span>
        <span className="wordmark__sub">A collection of things along the way.</span>
      </a>
      <nav className="masthead__nav" aria-label="Scrapbook">
        <a className="link" href="#about">About</a>
        <a className="link" href="#archive">Archive</a>
        <a className="link masthead__back" href="/"><span aria-hidden="true">←</span> Portfolio</a>
      </nav>
    </div>
  </header>

  <main id="main">

    {/* ============ B. OPENING INTRODUCTION ============ */}
    <section className="opening wrap" id="top" aria-labelledby="opening-title">
      <p className="kicker opening__kicker">Vol. 01 <span className="dot" aria-hidden="true"></span> Ongoing</p>

      <h1 className="opening__title" id="opening-title">
        The work, the <em>detours,</em> and everything in between.
      </h1>

      <div className="opening__foot">
        <p className="opening__lede">
          A growing collection of things I&apos;m building, learning, seeing, and figuring out along the way.
        </p>

        <ul className="meta opening__meta" aria-label="About this journal">
          <li>London, UK</li>
          <li>Personal journal</li>
          <li>2026</li>
        </ul>

        <nav className="contents" aria-label="In this issue">
          <p className="contents__label">In this issue</p>
          <ol>
            <li><a href="#now"><span>01</span> Where I am right now</a></li>
            <li><a href="#notes"><span>02</span> Field notes</a></li>
            <li><a href="#collected"><span>03</span> Collected along the way</a></li>
            <li><a href="#about"><span>04</span> Sussing it out</a></li>
          </ol>
        </nav>
      </div>
    </section>

    {/* ============ C. FEATURED ENTRY ============
         Images: swap the src / alt / width / height on each <img />.
         The frame keeps its shape from --ratio on the <figure>, so the layout holds while images load. */}
    <section className="section wrap" id="now" aria-labelledby="now-title">
      <header className="section-head">
        <span className="section-head__num">01</span>
        <span className="section-head__label">Where I am right now</span>
      </header>

      <article className="feature">
        <figure className="frame feature__lead" id="pl-01" style={{ "--ratio": "3 / 4" } as React.CSSProperties} data-sb-reveal="image">
          <span className="frame__img"><img src="/images/web/blog-1.jpg" alt="A narrow street at night, people gathered outside lit bars, a red neon sign glowing on the right."
               width="1200" height="1600" />
            {/* film-camera date imprint; keep it in step with the date in the caption */}
            <span className="stamp" aria-hidden="true">&rsquo;26 5 8</span></span>
          <figcaption className="caption">
            <span className="caption__plate">Pl. 01</span>{" "}
            Side street, after dark. <span className="caption__credit">Photo: A.O. · <time dateTime="2026-05-08">08.05.26</time></span>
          </figcaption>
        </figure>

        <div className="feature__text" data-sb-reveal="">
          <p className="status">
            <span className="status__dot" aria-hidden="true"></span>{" "}
            Current entry <span className="status__sep">/</span> <time dateTime="2026-10">October 2026</time>
          </p>

          <h2 className="feature__title" id="now-title">Somewhere between code and <em>creativity.</em></h2>

          <p className="feature__intro">
            I&apos;m finding my way back into software engineering while exploring how AI is changing the way we build things. Alongside that, I&apos;m still drawn to the creative side of life — the barbershop, photography, and the people and places that make London interesting.
          </p>

          <dl className="ledger">
            <div><dt>Writing software</dt><dd>~8 years</dd></div>
            <div><dt>Studied</dt><dd>MSc Artificial Intelligence, Northumbria University London</dd></div>
            <div><dt>Behind the chair</dt><dd>Barber, London</dd></div>
            <div><dt>Thinking about</dt><dd>Agentic AI in real workflows</dd></div>
          </dl>

          <a className="link link--read" href="#entry-001">Read the entry <span aria-hidden="true">→</span></a>
        </div>

        <figure className="frame feature__aside feature__aside--side" id="pl-02" style={{ "--ratio": "4 / 5" } as React.CSSProperties} data-sb-reveal="image">
          <span className="frame__img"><img src="/images/web/blog-2.jpg" alt="A dim bar in purple and red light, a blue neon sign reading &ldquo;Sing it back&rdquo; above the counter."
               width="1200" height="1600" loading="lazy" /></span>
          <figcaption className="caption">
            <span className="caption__plate">Pl. 02</span>{" "}
            &ldquo;Sing it back&rdquo;, in neon. <span className="caption__credit">Photo: A.O. · <time dateTime="2026-05-07">07.05.26</time></span>
          </figcaption>
        </figure>

        <figure className="frame feature__aside feature__aside--print" id="pl-03" style={{ "--ratio": "1 / 1" } as React.CSSProperties} data-sb-reveal="image">
          <span className="frame__img"><img src="/images/web/barber-1.jpg"
               alt="Black-and-white close-up of a young man mid-haircut, eyes closed, as a barber's tattooed hand lines up his hairline with clippers."
               width="1200" height="1600" loading="lazy" /></span>
          <figcaption className="caption">
            <span className="caption__plate">Pl. 03</span>{" "}
            Behind the chair. <span className="caption__credit">Photo: A.O. · <time dateTime="2026-06-06">06.06.26</time></span>
          </figcaption>
        </figure>

        <p className="scrawl feature__scrawl" aria-hidden="true">the other day job ↖ <span className="scrawl__more">barber, London</span></p>
      </article>
    </section>

    {/* ============ D. FIELD NOTES ============ */}
    <section className="section wrap" id="notes" aria-labelledby="notes-title">
      <header className="section-head">
        <span className="section-head__num">02</span>
        <span className="section-head__label">Fragments</span>
      </header>

      <div className="notes">
        <div className="notes__head">
          <h2 className="notes__title" id="notes-title">Field <em>notes</em></h2>
          <p className="notes__intro">Short things, written down before they slip away.</p>
        </div>

        <article className="note note--one" data-sb-reveal="">
          <p className="note__num" aria-hidden="true">01</p>
          <div className="note__body">
            <p className="note__meta">Field note 01 <span>·</span> Engineering</p>
            <h3 className="note__title">Building again</h3>
            <p>Back to spending more time thinking about systems, product decisions, and how AI can become genuinely useful rather than just impressive in a demo.</p>
            <button className="note__toggle" type="button" aria-expanded="false" aria-controls="note-01-more" hidden>More <span aria-hidden="true">+</span></button>
            <div className="note__more" id="note-01-more">
              <p>Around eight years of full-stack, backend and cloud work so far, more of it lately spent wiring AI services into real products. Before that came an MSc in Artificial Intelligence at Northumbria University London.</p>
            </div>
          </div>
          <p className="scrawl note__scrawl" aria-hidden="true">useful &gt; impressive</p>
        </article>

        <article className="note note--two" data-sb-reveal="">
          <p className="note__num" aria-hidden="true">02</p>
          <div className="note__body">
            <p className="note__meta">Field note 02 <span>·</span> Barbering</p>
            <h3 className="note__title">Behind the chair</h3>
            <p>Barbering taught me things about people, trust, and running a business that I wouldn&apos;t have learned by writing software alone. Those lessons still influence the products I want to build.</p>
            <button className="note__toggle" type="button" aria-expanded="false" aria-controls="note-02-more" hidden>More <span aria-hidden="true">+</span></button>
            <div className="note__more" id="note-02-more">
              <p>It also turned into software: I built a tool to help a barbershop manage appointments, payments, expenses and the rest of the day-to-day running of the business.</p>
            </div>
          </div>
          <p className="scrawl note__scrawl" aria-hidden="true">→ and then it became software</p>
        </article>

        <article className="note note--three" data-sb-reveal="">
          <p className="note__num" aria-hidden="true">03</p>
          <div className="note__body">
            <p className="note__meta">Field note 03 <span>·</span> Photography</p>
            <h3 className="note__title">Noticing things</h3>
            <p>Photography is a reason to slow down and pay attention. I&apos;m interested in the little details, the atmosphere of a place, and the stories hiding in ordinary moments.</p>
            <button className="note__toggle" type="button" aria-expanded="false" aria-controls="note-03-more" hidden>More <span aria-hidden="true">+</span></button>
            <div className="note__more" id="note-03-more">
              <p>Apart from the engineering stand-in, the photographs on this page are mine: most taken on a phone, the mountains on a Sony &alpha;6400.</p>
            </div>
          </div>
        </article>
      </div>
    </section>

    {/* ============ E. THE VISUAL JOURNEY ============
         Each <figure> is one tile. Replace the <img /> src/alt and the caption text.
         --ratio sets the tile shape; keep width/height on the <img /> roughly matching. */}
    <section className="section section--journey" id="collected" aria-labelledby="collected-title">
      <div className="wrap">
        <header className="section-head">
          <span className="section-head__num">03</span>
          <span className="section-head__label">Plates</span>
        </header>

        <div className="journey__head">
          <h2 className="journey__title" id="collected-title">Collected <em>along the way</em></h2>
          <p className="journey__sub">A few different worlds, all part of the same story.</p>
        </div>

        <div className="journey">
          {/* 1. Engineering & AI */}
          <figure className="frame tile tile--a is-stand-in" id="pl-i" style={{ "--ratio": "4 / 3" } as React.CSSProperties} data-sb-reveal="image">
            <span className="frame__img"><img src="https://images.unsplash.com/photo-1555066931-4365d14bab8c?auto=format&fit=crop&w=1400&h=1050&q=75"
                 alt="A laptop in a dim room, its screen full of code in a dark editor theme."
                 width="1400" height="1050" loading="lazy" /></span>
            <figcaption className="caption caption--theme">
              <span className="caption__theme">I — Engineering &amp; AI</span>
              <span className="caption__line">Ideas becoming real.</span>
              <span className="caption__credit">Stand-in · Unsplash</span>
            </figcaption>
          </figure>

          <p className="scrawl tile__scrawl tile__scrawl--b" aria-hidden="true">same problems,<br />different chair ↓</p>

          {/* 2. Barbering & craftsmanship */}
          <figure className="frame tile tile--b" id="pl-ii" style={{ "--ratio": "4 / 5" } as React.CSSProperties} data-sb-reveal="image">
            <span className="frame__img"><img src="/images/web/barber-2.jpg"
                 alt="Black-and-white photo inside a barbershop: a barber cuts a young boy's hair while the boy sits under a patterned cape."
                 width="1200" height="1600" loading="lazy" /></span>
            <figcaption className="caption caption--theme">
              <span className="caption__theme">II — Barbering &amp; craft</span>
              <span className="caption__line">A craft built around people.</span>
              <span className="caption__credit">Photo: A.O. · <time dateTime="2026-04-11">11.04.26</time></span>
            </figcaption>
          </figure>

          {/* 3. Photography & everyday observations */}
          <figure className="frame tile tile--c" id="pl-iii" style={{ "--ratio": "3 / 4" } as React.CSSProperties} data-sb-reveal="image">
            <span className="frame__img"><img src="/images/web/blog-3.jpg" alt="A huge sculpture clad in stone-like tiles sits between two modern office blocks, a residential tower beyond under a pale sky."
                 width="1200" height="1539" loading="lazy" /></span>
            <figcaption className="caption caption--theme">
              <span className="caption__theme">III — Photography</span>
              <span className="caption__line">Things worth noticing.</span>
              <span className="caption__credit">Photo: A.O. · <time dateTime="2026-06-07">07.06.26</time></span>
            </figcaption>
          </figure>

          {/* 4. Life in London */}
          <figure className="frame tile tile--d" id="pl-iv" style={{ "--ratio": "4 / 5" } as React.CSSProperties} data-sb-reveal="image">
            <span className="frame__img"><img src="/images/web/blog-4.jpg" alt="A large white yacht moored on dark water beneath two glass residential towers, under an overcast sky."
                 width="1200" height="1601" loading="lazy" /></span>
            <figcaption className="caption caption--theme">
              <span className="caption__theme">IV — Life in London</span>
              <span className="caption__line">Life between projects.</span>
              <span className="caption__credit">Photo: A.O. · <time dateTime="2026-06-07">07.06.26</time></span>
            </figcaption>
          </figure>

          {/* Contact strip: three small frames, each dated under its frame */}
          <figure className="strip tile--e" id="pl-contact" data-sb-reveal="">
            <div className="strip__film">
              <p className="strip__edge" aria-hidden="true"><span>A.O. 2026</span><span>▸ 14</span><span>▸ 15</span><span>▸ 16</span></p>
              <ol className="strip__frames">
                <li className="frame" style={{ "--ratio": "3 / 4" } as React.CSSProperties}>
                  <span className="frame__img"><img src="/images/web/photo1.jpg" alt="Two lattice crane towers silhouetted against a dusk sky above a dark building."
                       width="1200" height="1600" loading="lazy" /></span>
                  <span className="strip__date" aria-hidden="true">24.05</span>
                </li>
                <li className="frame strip__pick" style={{ "--ratio": "3 / 4" } as React.CSSProperties}>
                  <span className="frame__img"><img src="/images/web/photo7.jpg" alt="Tower blocks and a construction crane in silhouette against a deep teal evening sky."
                       width="1200" height="1600" loading="lazy" /></span>
                  <svg className="strip__circle" viewBox="0 0 120 150" aria-hidden="true" preserveAspectRatio="none">
                    <path pathLength="1" d="M62 6C30 4 8 30 7 74c-1 42 22 70 56 70 33 0 52-30 51-72C113 34 92 9 58 8 47 8 38 12 33 16" />
                  </svg>
                  <span className="strip__date" aria-hidden="true">21.06</span>
                </li>
                <li className="frame" style={{ "--ratio": "3 / 4" } as React.CSSProperties}>
                  <span className="frame__img"><img src="/images/web/photo8.jpg" alt="A tall tower in silhouette against a blue night sky, with a thin crescent moon beside it."
                       width="1200" height="1586" loading="lazy" /></span>
                  <span className="strip__date" aria-hidden="true">20.06</span>
                </li>
              </ol>
            </div>
            <figcaption className="caption">
              <span className="caption__plate">Contact</span>{" "}
              Three evenings, late spring. <span className="caption__credit">Photos: A.O. · <time dateTime="2026-05">May</time>–<time dateTime="2026-06">June 2026</time></span>
            </figcaption>
            <p className="scrawl strip__note" aria-hidden="true">this one. <span className="scrawl__more">21.06, just after nine</span></p>
          </figure>

          {/* Closing plate: further from home */}
          <figure className="frame tile tile--f" id="pl-04" style={{ "--ratio": "3 / 2" } as React.CSSProperties} data-sb-reveal="image">
            <span className="frame__img"><img src="/images/web/blog-6.jpg" alt="A rocky mountain ridge at dusk, a snow-capped peak catching the last light beneath a deep teal sky."
                 width="1800" height="1200" loading="lazy" /></span>
            <figcaption className="caption">
              <span className="caption__plate">Pl. 04</span>{" "}
              Further afield, at dusk. <span className="caption__credit">Photo: A.O. · <time dateTime="2024-11-16">16.11.24</time></span>
            </figcaption>
          </figure>
        </div>
      </div>
    </section>

    {/* ============ F. REFLECTION ============ */}
    <section className="section reflection wrap" id="about" aria-labelledby="about-title">
      <header className="section-head">
        <span className="section-head__num">04</span>
        <span className="section-head__label">Afterword</span>
      </header>

      <div className="reflection__grid">
        <div className="reflection__body" data-sb-reveal="">
          <h2 className="reflection__title" id="about-title">Sussing it <em>out.</em></h2>

          <p className="reflection__lead">I&apos;m interested in the space between technology and the real world — the problems people deal with every day, the tools that make those problems easier, and the creative process of turning an idea into something useful.</p>

          <p>Right now, that means learning more about AI, building products, finding my place in engineering again, and holding on to the things that make life interesting outside a screen.</p>

          <p className="reflection__close">Moving towards greater things.</p>

          <p className="scrawl reflection__sign" aria-hidden="true">— Ayush.</p>
        </div>

        {/* Plates in this issue: mirrors "In this issue" at the top. Keep in step with the captions above. */}
        <nav className="plates" aria-labelledby="plates-title" data-sb-reveal="">
          <p className="plates__label" id="plates-title">Plates in this issue</p>
          <ol>
            <li><a href="#pl-01"><span className="plates__no">01</span> Side street, after dark <time dateTime="2026-05-08">08.05.26</time></a></li>
            <li><a href="#pl-02"><span className="plates__no">02</span> &ldquo;Sing it back&rdquo; <time dateTime="2026-05-07">07.05.26</time></a></li>
            <li><a href="#pl-03"><span className="plates__no">03</span> Behind the chair <time dateTime="2026-06-06">06.06.26</time></a></li>
            <li><a href="#pl-i"><span className="plates__no">I</span> Ideas becoming real <span className="plates__aside">stand-in</span></a></li>
            <li><a href="#pl-ii"><span className="plates__no">II</span> A craft built around people <time dateTime="2026-04-11">11.04.26</time></a></li>
            <li><a href="#pl-iii"><span className="plates__no">III</span> Things worth noticing <time dateTime="2026-06-07">07.06.26</time></a></li>
            <li><a href="#pl-iv"><span className="plates__no">IV</span> Life between projects <time dateTime="2026-06-07">07.06.26</time></a></li>
            <li><a href="#pl-contact"><span className="plates__no">C</span> Three evenings <time dateTime="2026-06">05&ndash;06.26</time></a></li>
            <li><a href="#pl-04"><span className="plates__no">04</span> Further afield <time dateTime="2024-11-16">16.11.24</time></a></li>
          </ol>
        </nav>
      </div>
    </section>

  </main>

  {/* ============ G. FOOTER ============ */}
  <footer className="colophon">
    <div className="wrap colophon__inner">
      <p className="wordmark__title colophon__mark"><em>The</em> Scrapbook</p>
      <p className="colophon__more">More to come.</p>
      <p className="colophon__links">
        <a className="link" href="/"><span aria-hidden="true">←</span> Back to the portfolio</a>
      </p>
      <ul className="meta colophon__meta"><li>London, UK</li><li>© <span id="year">2026</span></li></ul>
    </div>
  </footer>

  
    <ScrapbookEffects />
  </>
);
