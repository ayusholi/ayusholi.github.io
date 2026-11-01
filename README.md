# ayusholi.com.np

One Next.js application, exported as a static site:

| URL | Section |
| --- | --- |
| `/` | Portfolio |
| `/blog/` | The Scrapbook |
| `/how/` | How Things Work: interactive simulations |

    npm install
    npm run dev       # http://localhost:3000
    npm run check     # types, lint, unit and architecture tests, production build
    npm run preview   # serve the built site from out/ on :8124
    npm run test:e2e  # browser journeys against the built site (build first)

## Layout

```
src/
  app/          routing only: routes, metadata, layouts. Pages here stay under 70 lines
  templates/    one page's markup each, composed from the layers below
    portfolio/  scrapbook/  how/ (home, topic pages, 404)
  features/     interactive behaviour, one folder each
    redis/  kafka/            simulation engines and their views
    portfolio/  scrapbook/    the original page scripts, ported and typed
  components/   reusable presentation with no domain knowledge
  lib/          content catalogue, simulation runtime, fonts, site constants
  styles/       portfolio.css (no Tailwind) and how.css (Tailwind layer)
public/         served as-is: images/, favicon, redirects for old URLs
source-images/  full-size originals. Not served; images/web are the resized copies
docs/reference/ reference material
e2e/            Playwright journeys
scripts/        the preview server
.github/        the deploy workflow
```

Dependencies only point down, and `src/architecture.test.ts` enforces it:

    app -> templates -> features -> components -> lib

A layer may import from itself and from anything to its right. Engines
(`*-engine.ts`, `*-types.ts`, `*-content.ts`, `*-scenarios.ts`) also can't import
React or Next, touch the DOM, or read the real clock, so they run in plain Node.

Each section has its own root layout, so styles never cross: the portfolio and
Scrapbook load `portfolio.css` and no Tailwind. Moving between sections is a full page
load. Portfolio and Scrapbook markup is kept element for element, because their CSS
and scripts target it.

## Deploying

Pushing to `main` runs `.github/workflows/deploy.yml`, which runs `npm run check` and
publishes `out/` to GitHub Pages. Build output is never committed.

**One-time setup:** in the repo's Settings > Pages, set Source to "GitHub Actions".
Until that's done the site keeps serving the old branch contents.

## How the simulations work

A simulation is pure functions: `action(state) -> frames`. Each frame holds the
full state after one transition, plus anything that moved during it.

    *-engine.ts  ->  Timeline (lib/simulation)  ->  React views
    no React         play, pause, step, speed       draw one frame's state

- **The engine decides what happened.** Views can't disagree with it, because
  they only draw a frame's state. Time is simulated, so runs are deterministic.
- **React renders once per frame.** `useTimelineFrame` reads the timeline as an
  external store. Packets moving between frames bypass React (`onProgress`), so
  60fps animation causes no re-renders.
- **Domain state lives in the Timeline; UI state in `useState`.** Rewinding is
  moving through saved frames, which is why there's no reducer or global store.
- **Prose is server-rendered.** A provider (`RedisProvider`) shares one simulation
  between small client panels placed inside a server-rendered article.

Tailwind utilities override the component layer. Avoid naming a component class
after a utility (`block`, `hidden`, `flex`): the utility wins.

## Adding a topic

1. Add or update its entry in `src/lib/content/topics.ts`, and a drawing in
   `components/topics/TopicPreview.tsx`. It now appears on the homepage, and at
   `/how/topics/<slug>`, as "On the drawing board".
2. Write `src/features/<slug>/<slug>-engine.ts` with tests. Start here: if the
   model is wrong, nothing else matters.
3. Add `<slug>-content.ts`, with a `describe(frame)` that narrates from the frame's
   state, then the views (`SystemDiagram` suits node graphs, plain components the rest).
4. Write the page template in `src/templates/how/topics/<Slug>Article.tsx`, and register
   it in `registry.tsx` and `published.ts`. Then set `status: "published"` with learning
   objectives. The tests fail if these disagree, or if a plate row doesn't fill twelve columns.

## House rules

- `--signal` marks what's moving, and nothing else.
- Never show state by colour alone: pair it with a glyph, a pattern or text.
- State a model's assumptions on the page, and label invented numbers as illustrative.

## Deliberate simplifications

Each topic's "Fine print" section lists them for readers. Redis: one app, one node,
one Postgres, and a clock that moves only when told. Kafka: one group, no
replication, ticks instead of time, a small hash, range assignment, stop-the-world
rebalancing.

## For the backend phase

`src/lib/content/index.ts` is already async, so an API can replace the local modules
there. A server-side feature means removing `output: "export"` from `next.config.ts`
and moving off GitHub Pages.
