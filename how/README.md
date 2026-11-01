# How Things Work

An interactive publication at `/how/`. Plain HTML, CSS and ES modules, with no
dependencies and no build step, matching the rest of the site.

    python3 -m http.server 8123      # from the repo root, then open /how/
    node --test "how/test/*.test.js" # simulation and timeline tests

Modules don't load from `file://`, so always preview through a server.

## How it fits together

A simulation is pure functions: `action(state) -> frames`. Each frame holds the
full state after one transition, plus any packets that moved during it.

    sim.js  ->  Timeline (js/core/timeline.js)  ->  view
    no DOM      play, pause, step, rewind, speed    draws one frame's state

The view never decides what happened, so an animation can't contradict the
state. Rewinding moves through saved frames. New actions apply to the newest state.

| Path | Purpose |
| --- | --- |
| `js/config.js` | The publication's name, in one place |
| `js/topics.js` | Topic and collection registry; drives the homepage and related links |
| `js/previews.js` | One small SVG drawing per topic |
| `js/core/` | Timeline, transport controls, stage (nodes, wires, packets), challenge |
| `how.css` | Tokens, the drawing sheet, shared and per-topic styles |
| `<slug>/sim.js` | Pure logic, tested in `test/` |
| `<slug>/content.js` | The topic's words: captions, scenarios |
| `<slug>/bench.js` | Wires the sim, timeline and panels to the page |

## Adding a topic

1. Write `how/<slug>/sim.js` and a test. Start here: if the model is wrong, nothing else matters.
2. Add `content.js` with a `describe(frame)` that narrates from the frame's state.
3. Copy a topic's `index.html`. Keep the masthead, footer, `#related` and the
   `chrome.js` script, then replace the sections to suit the subject.
4. Write `bench.js`. Build the view that suits the subject: `createStage` for node
   diagrams, plain DOM for anything else (Kafka's tapes). Use `Timeline` either way.
   Pass `generate` if the system should keep running by itself.
5. In `js/topics.js`, set the topic's `status: "live"` and add `intro`, `objective`
   and `related`. Add it to `CONCEPT_LINKS` so the collections index links to it.

## House rules

- `--signal` marks what's moving, and nothing else.
- Never show state by colour alone: pair it with a glyph, a pattern or text.
- State the model's assumptions on the page, and label invented numbers as illustrative.
- A "planned" topic is never a link.
