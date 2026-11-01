// =========================================================
// "Under the hood": an illustrative architecture playground, ported from the
// original playground.js with its logic and timing unchanged,
// plus a small decorative robot that lives in its dock.
// Everything here is local and deterministic: no network calls,
// no real traffic, no real agent.
// =========================================================
export function initPlayground() {
  const diagram = document.getElementById("pg-diagram") as HTMLElement;

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

  // ---------- Data ----------
  type NodeInfo = { name: string; role: string; tech: string[]; talks: string; consider: string };
  type Step = { at: string; text: string; tag?: string; code?: string };
  type Scenario = { title: string; steps: Step[]; outro: string };

  const NODES: Record<string, NodeInfo> = {
    client: { name: "Client", role: "Where users start: a browser or a mobile app.", tech: ["Browser", "Flutter (mobile)"], talks: "Sends requests to the frontend and API over HTTPS.", consider: "Assume it can be modified. Anything it sends is validated again on the server." },
    web: { name: "Frontend", role: "Renders the UI, handles routing and gives fast feedback on forms.", tech: ["Next.js", "React", "TypeScript"], talks: "Calls the API. Never talks to the database directly.", consider: "Page speed and SEO: render on the server where it helps and keep client JavaScript small." },
    api: { name: "API", role: "The application core: authentication, validation and business rules.", tech: ["NestJS", "Express", "REST / GraphQL"], talks: "Reads and writes the database, and hands AI requests to the agent runtime.", consider: "One home for the rules, so the UI, the agent and background jobs can't disagree." },
    db: { name: "Database", role: "Persistent application data, and the source of truth.", tech: ["SQL (e.g. PostgreSQL)", "Migrations"], talks: "Written by the API inside transactions. Committed changes publish events to the queue.", consider: "Transactions, indexes and constraints. Let the database itself prevent double bookings." },
    queue: { name: "Event queue", role: "Holds work that shouldn't block a request.", tech: ["A job or message queue", "Outbox pattern"], talks: "Fed by database changes, consumed by workers.", consider: "Delivery is at-least-once, so every consumer has to be idempotent." },
    worker: { name: "Workers", role: "Run background jobs: emails, reminders, payment follow-ups.", tech: ["Node.js", "Docker"], talks: "Pull jobs from the queue and call external APIs.", consider: "Retries with backoff, idempotency keys and a dead-letter queue for jobs that keep failing." },
    ext: { name: "External APIs", role: "Third-party services the product depends on.", tech: ["Payments provider", "Email", "SMS (e.g. Twilio)"], talks: "Called by workers. Can call back through signed webhooks.", consider: "They will fail sometimes. Plan for timeouts, retries and signature checks." },
    llm: { name: "AI model", role: "A language model that reads the conversation and proposes the next step.", tech: ["LLMs via OpenRouter", "Ollama (local)"], talks: "Only talks to the agent runtime. It has no direct access to data or tools.", consider: "Its output is a suggestion. Treat it like any other untrusted input." },
    agent: { name: "Agent runtime", role: "Runs the loop between the model and the app: prompt, propose, validate, execute.", tech: ["TypeScript / Python", "LangChain", "JSON Schema"], talks: "Receives requests from the API, asks the model, calls tools.", consider: "Check every tool call against a schema and the user's permissions before anything runs." },
    tools: { name: "Tools", role: "A small set of app functions the agent may call, like find_slots or reschedule_booking.", tech: ["MCP servers", "Service layer"], talks: "Called only by the agent runtime, and run through the same services as the UI.", consider: "Narrow, well-typed tools that carry the user's permissions. Never a raw database handle." },
  };

  // Primary direction of each connection; packets can travel either way.
  const EDGES: [string, string][] = [
    ["client", "web"], ["web", "api"], ["api", "db"], ["db", "queue"], ["queue", "worker"],
    ["worker", "ext"], ["api", "agent"], ["agent", "llm"], ["agent", "tools"],
  ];

  const SCENARIOS: Record<string, Scenario> = {
    booking: {
      title: "A user makes a booking",
      steps: [
        { at: "client", text: "A guest picks Friday at 3pm and taps Book." },
        { at: "web", text: "The frontend checks the form and sends the request with the user's session.", tag: "validation" },
        { at: "api", text: "The API authenticates the user and validates everything again. Never trust the client.", tag: "validation" },
        { at: "db", text: "One transaction checks the slot is still free, then inserts the booking. Two people can't take the same chair.", tag: "transaction" },
        { at: "queue", text: "On commit, a booking.created event is queued, so the response doesn't wait for email." },
        { at: "worker", text: "A worker picks up the event and builds the confirmation." },
        { at: "ext", text: "The email or SMS provider sends it. If it times out, the worker retries.", tag: "retry" },
      ],
      outro: "The user saw “Booked” as soon as the transaction committed. The confirmation followed a moment later, off the request path.",
    },
    payment: {
      title: "A payment is processed",
      steps: [
        { at: "client", text: "The user pays a deposit." },
        { at: "web", text: "The frontend sends the payment request with an idempotency key.", tag: "validation" },
        { at: "api", text: "The API works out the amount on the server, never from the client.", tag: "validation" },
        { at: "db", text: "A pending payment row is written in a transaction.", tag: "transaction" },
        { at: "queue", text: "A payment job is queued." },
        { at: "worker", text: "A worker calls the payment provider with the same idempotency key." },
        { at: "ext", text: "The provider charges the card. A retry with the same key can't charge twice.", tag: "retry" },
        { at: "worker", text: "The worker gets the result, or a webhook it verifies by signature.", tag: "validation" },
        { at: "queue", text: "The outcome is published as an event." },
        { at: "db", text: "The payment is marked paid. Only now is the booking confirmed.", tag: "transaction" },
      ],
      outro: "Money moves exactly once, even if any step is retried.",
    },
    notify: {
      title: "A reminder is delivered",
      steps: [
        { at: "db", text: "A booking is due tomorrow, and a scheduled job finds it." },
        { at: "queue", text: "A reminder job is queued with a dedupe key so it's only sent once.", tag: "validation" },
        { at: "worker", text: "A worker writes the message in the user's time zone." },
        { at: "ext", text: "The SMS provider delivers it. Failures go back on the queue with backoff.", tag: "retry" },
      ],
      outro: "Nothing here touches the request path. The user never waits on a reminder.",
    },
    agent: {
      title: "An AI agent uses a tool",
      steps: [
        { at: "client", text: "The user writes: “Move my Friday 3pm to Saturday morning.”", code: 'user: "Move my Friday 3pm to Saturday morning."' },
        { at: "web", text: "The chat UI sends the message to the API with the user's session." },
        { at: "api", text: "The API authenticates the user and passes the request to the agent runtime with their ID and permissions.", tag: "validation" },
        { at: "agent", text: "The runtime sends the conversation to the model, plus the tools it may use, each with a JSON schema.", code: "tools: find_slots, reschedule_booking" },
        { at: "llm", text: "The model proposes a tool call. It doesn't run anything itself.", code: '{ "tool": "reschedule_booking",\n  "args": { "booking_id": "bk_142", "slot": "Sat 10:00" } }' },
        { at: "agent", text: "The runtime validates the proposal: the arguments match the schema, the booking belongs to this user, the slot is free. Anything that fails is rejected and explained back to the model.", tag: "validation", code: "✓ arguments match schema\n✓ bk_142 belongs to this user\n✓ Sat 10:00 is free" },
        { at: "tools", text: "The tool runs through the same service layer as the normal UI, so the same rules apply. (Simulated here.)", tag: "transaction", code: "reschedule_booking → ok (simulated)" },
        { at: "agent", text: "The result goes back to the model, which writes a short reply." },
        { at: "api", text: "The API returns the reply and the updated booking." },
        { at: "web", text: "The UI updates the booking card." },
        { at: "client", text: "“Done. You're booked for Saturday at 10:00.”", code: 'assistant: "Done. You\'re booked for Saturday at 10:00."' },
      ],
      outro: "The model chooses; the application decides. Permissions and business rules are enforced in code, not in the prompt.",
    },
    failure: {
      title: "A service fails and recovers",
      steps: [
        { at: "queue", text: "A confirmation job is waiting." },
        { at: "worker", text: "A worker picks it up." },
        { at: "ext", text: "The email provider times out with a 503.", tag: "error" },
        { at: "worker", text: "The worker backs off: 1s, then 2s, then 4s. The job is idempotent, so retrying is safe.", tag: "retry" },
        { at: "ext", text: "The next attempt succeeds.", tag: "ok" },
        { at: "worker", text: "The worker records the success." },
        { at: "queue", text: "The job is acknowledged. After too many failures it would go to a dead-letter queue for a person to check." },
      ],
      outro: "Failures are expected, so recovery is designed in rather than patched on.",
    },
  };

  const TAG_LABEL: Record<string, string> = { validation: "Validation", transaction: "Transaction", retry: "Retry", error: "Error", ok: "Recovered" };

  // ---------- Elements ----------
  const byId = (id: string) => document.getElementById(id) as HTMLElement;
  const svg = byId("pg-wires");
  const panel = byId("pg-panel");
  const content = byId("pg-content");
  const kicker = byId("pg-kicker");
  const closeBtn = byId("pg-close");
  const chips = [...document.querySelectorAll<HTMLElement>("[data-scenario]")];
  const nodeEls: Record<string, HTMLElement> = {};
  diagram.querySelectorAll<HTMLElement>("[data-node]").forEach((el) => { nodeEls[el.dataset.node as string] = el; });
  const node = (id: string) => nodeEls[id] as HTMLElement;
  const info = (id: string) => NODES[id] as NodeInfo;
  type Box = { x: number; y: number; hw: number; hh: number };
  const defaultPanel = content.innerHTML;
  const SVG_NS = "http://www.w3.org/2000/svg";

  // ---------- Wires ----------
  const wires = EDGES.map(([from, to]) => {
    const path = document.createElementNS(SVG_NS, "path");
    path.setAttribute("class", "wire");
    path.setAttribute("marker-end", "url(#pg-arrow)");
    svg.appendChild(path);
    return { from, to, path };
  });
  const packet = document.createElementNS(SVG_NS, "rect");
  packet.setAttribute("class", "packet");
  packet.setAttribute("width", "12");
  packet.setAttribute("height", "12");
  svg.appendChild(packet);

  // Box of a node relative to the diagram (offset* ignores hover transforms)
  const box = (id: string): Box => {
    const el = node(id);
    return { x: el.offsetLeft + el.offsetWidth / 2, y: el.offsetTop + el.offsetHeight / 2, hw: el.offsetWidth / 2 + 6, hh: el.offsetHeight / 2 + 6 };
  };
  // Point where the line between two centres leaves a box
  const exitPoint = (b: Box, dx: number, dy: number): [number, number] => {
    const t = Math.min(dx ? b.hw / Math.abs(dx) : Infinity, dy ? b.hh / Math.abs(dy) : Infinity);
    return [b.x + dx * t, b.y + dy * t];
  };
  const layoutWires = () => {
    svg.setAttribute("width", String(diagram.scrollWidth));
    svg.setAttribute("height", String(diagram.scrollHeight));
    wires.forEach((w) => {
      const a = box(w.from), b = box(w.to);
      const dx = b.x - a.x, dy = b.y - a.y;
      const [x1, y1] = exitPoint(a, dx, dy);
      const [x2, y2] = exitPoint(b, -dx, -dy);
      w.path.setAttribute("d", `M${x1.toFixed(1)} ${y1.toFixed(1)} L${x2.toFixed(1)} ${y2.toFixed(1)}`);
    });
  };
  const wireBetween = (a: string, b: string) => wires.find((w) => (w.from === a && w.to === b) || (w.from === b && w.to === a));
  const wiresOf = (id: string) => wires.filter((w) => w.from === id || w.to === id);

  layoutWires();
  new ResizeObserver(layoutWires).observe(diagram);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(layoutWires);

  // ---------- Packet travel ----------
  let runToken = 0;   // bumps whenever a scenario is cancelled
  const travel = (a: string, b: string, token: number, duration = 650) => new Promise<void>((resolve) => {
    const w = wireBetween(a, b);
    if (!w || reduceMotion) return resolve();
    const len = w.path.getTotalLength();
    const forward = w.from === a;
    w.path.classList.add("is-flow");
    packet.classList.add("is-on");
    const start = performance.now();
    const step = (now: number) => {
      if (token !== runToken) { w.path.classList.remove("is-flow"); return resolve(); }
      const t = Math.min(1, (now - start) / duration);
      const eased = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
      const p = w.path.getPointAtLength(len * (forward ? eased : 1 - eased));
      packet.setAttribute("x", String(p.x - 6));
      packet.setAttribute("y", String(p.y - 6));
      if (t < 1) requestAnimationFrame(step);
      else { w.path.classList.remove("is-flow"); resolve(); }
    };
    requestAnimationFrame(step);
  });

  // ---------- Panel ----------
  const escapeHtml = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] as string));
  const setPanel = (label: string, html: string, closable: boolean) => {
    kicker.textContent = label;
    content.innerHTML = html;
    closeBtn.hidden = !closable;
    panel.classList.remove("is-swap");
    void panel.offsetWidth;   // restart the swap animation
    panel.classList.add("is-swap");
  };
  const resetPanel = () => setPanel("Explore", defaultPanel, false);

  // ---------- Node interactions ----------
  let selected: string | null = null;
  const clearStates = () => {
    Object.values(nodeEls).forEach((el) => el.classList.remove("is-selected", "is-active", "is-dim", "is-path", "is-error", "is-ok"));
    wires.forEach((w) => w.path.classList.remove("is-lit", "is-path"));
    packet.classList.remove("is-on");
  };
  const light = (id: string, on: boolean) => wiresOf(id).forEach((w) => w.path.classList.toggle("is-lit", on));

  const selectNode = (id: string) => {
    stopScenario();
    clearStates();
    selected = id;
    const el = node(id);
    el.classList.add("is-selected", "is-pop");
    setTimeout(() => el.classList.remove("is-pop"), 450);
    light(id, true);
    const n = info(id);
    const neighbours = wiresOf(id).map((w) => info(w.from === id ? w.to : w.from).name).join(", ");
    setPanel("Component", `
      <h3>${n.name}</h3>
      <p>${n.role}</p>
      <h4>Typical tools from my stack</h4>
      <ul class="pg__tech">${n.tech.map((t) => `<li>${t}</li>`).join("")}</ul>
      <h4>Talks to · ${neighbours}</h4>
      <p>${n.talks}</p>
      <h4>Engineering consideration</h4>
      <p>${n.consider}</p>`, true);
    robot.lookAt(id);
    // stacked layout: bring the details into view if they're below the fold
    const pr = panel.getBoundingClientRect();
    if (window.matchMedia("(max-width: 1000px)").matches && pr.top > window.innerHeight - 120) {
      panel.scrollIntoView({ block: "nearest", behavior: reduceMotion ? "auto" : "smooth" });
    }
  };
  const deselect = () => { selected = null; stopScenario(); clearStates(); resetPanel(); };

  Object.entries(nodeEls).forEach(([id, el]) => {
    el.addEventListener("pointerenter", () => light(id, true));
    el.addEventListener("pointerleave", () => { if (selected !== id) light(id, false); });
    el.addEventListener("focus", () => light(id, true));
    el.addEventListener("blur", () => { if (selected !== id) light(id, false); });
    el.addEventListener("click", () => (selected === id ? deselect() : selectNode(id)));
  });
  closeBtn.addEventListener("click", deselect);
  byId("pg-reset").addEventListener("click", deselect);
  (diagram.closest(".pg") as HTMLElement).addEventListener("keydown", (e) => { if (e.key === "Escape" && (selected || running)) deselect(); });

  // ---------- Scenarios ----------
  let running: string | null = null;
  const stopScenario = () => {
    runToken++;
    if (running) robot.observe(false);
    running = null;
    chips.forEach((c) => c.setAttribute("aria-pressed", "false"));
  };

  const runScenario = async (key: string) => {
    const sc = SCENARIOS[key] as Scenario;
    deselect();
    const token = runToken;
    running = key;
    chips.forEach((c) => c.setAttribute("aria-pressed", String(c.dataset.scenario === key)));

    const pathIds = new Set(sc.steps.map((s) => s.at));
    Object.entries(nodeEls).forEach(([id, el]) => el.classList.add(pathIds.has(id) ? "is-path" : "is-dim"));
    sc.steps.forEach((s, i) => { if (i) { const w = wireBetween((sc.steps[i - 1] as Step).at, s.at); if (w) w.path.classList.add("is-path"); } });

    const hasCode = sc.steps.some((s) => s.code);
    setPanel("Scenario", `
      <h3>${sc.title}</h3>
      <ol class="pg__steps">${sc.steps.map((s) => `
        <li>${s.tag ? `<span class="tag-mini tag-mini--${s.tag}">${TAG_LABEL[s.tag]}</span>` : ""}<span class="pg__step-node">${info(s.at).name}</span> ${escapeHtml(s.text)}</li>`).join("")}
      </ol>
      ${hasCode ? '<pre class="pg__trace" aria-label="Simulated trace"><code id="pg-trace"></code></pre>' : ""}
      <p class="pg__outro" hidden>${sc.outro}</p>`, true);
    const items = [...content.querySelectorAll<HTMLElement>(".pg__steps li")];
    const trace = content.querySelector("#pg-trace");
    robot.observe(true);

    const show = (i: number) => {
      const s = sc.steps[i] as Step;
      items.forEach((li, j) => { li.classList.toggle("is-current", j === i); li.classList.toggle("is-done", j < i); });
      Object.values(nodeEls).forEach((el) => el.classList.remove("is-active"));
      const el = node(s.at);
      el.classList.remove("is-error", "is-ok");
      el.classList.add("is-active");
      if (s.tag === "error") el.classList.add("is-error");
      if (s.tag === "ok") el.classList.add("is-ok");
      if (s.code && trace) trace.textContent += (trace.textContent ? "\n\n" : "") + s.code;
      // keep the current step in view when the panel scrolls (wide screens)
      if (panel.scrollHeight > panel.clientHeight) panel.scrollTo({ top: (items[i] as HTMLElement).offsetTop - 70, behavior: reduceMotion ? "auto" : "smooth" });
      robot.lookAt(s.at);
    };

    if (reduceMotion) {
      // No travel: show the whole sequence at once
      sc.steps.forEach((s, i) => show(i));
      items.forEach((li) => { li.classList.remove("is-current"); li.classList.add("is-done"); });
    } else {
      for (let i = 0; i < sc.steps.length; i++) {
        if (i) await travel((sc.steps[i - 1] as Step).at, (sc.steps[i] as Step).at, token);
        if (token !== runToken) return;
        show(i);
        await wait((sc.steps[i] as Step).tag === "error" ? 1500 : 1100);
        if (token !== runToken) return;
      }
      items.forEach((li) => { li.classList.remove("is-current"); li.classList.add("is-done"); });
      packet.classList.remove("is-on");
    }
    (content.querySelector(".pg__outro") as HTMLElement).hidden = false;
    running = null;
    robot.observe(false);
    robot.celebrate();
  };
  chips.forEach((c) => c.addEventListener("click", () => runScenario(c.dataset.scenario as string)));

  // =========================================================
  // Robot: a tiny decorative character with a few states
  // (idle, observing, working, curious, resting).
  // One loop, one bubble timer; paused when hidden or off-screen.
  // =========================================================
  const robot = (() => {
    const dock = byId("robot-dock");
    const el = byId("robot");
    const btn = byId("robot-btn");
    const bubble = byId("robot-bubble");
    let loopToken = 0, visible = false, watching = false, bubbleTimer = 0, x = 0, workCount = 0, clickCount = 0;

    const setState = (s: string) => { el.dataset.state = s; };
    const pulse = (cls: string, ms: number) => { el.classList.add(cls); setTimeout(() => el.classList.remove(cls), ms); };
    const say = (text: string, ms = 2600) => {
      clearTimeout(bubbleTimer);
      bubble.textContent = text;
      el.classList.add("is-talking");
      bubbleTimer = window.setTimeout(() => { el.classList.remove("is-talking"); }, ms);
    };
    const moveTo = (nx: number) => {
      const max = Math.max(0, dock.clientWidth - el.offsetWidth);
      x = Math.max(0, Math.min(max, nx * max));
      el.style.setProperty("--x", `${x}px`);
    };
    // Point the eyes at a node (or straight ahead)
    const lookAt = (id: string | null) => {
      if (!id || !nodeEls[id]) { el.style.setProperty("--lx", "0"); el.style.setProperty("--ly", "0"); return; }
      const n = box(id);
      const rx = dock.offsetLeft + x + el.offsetWidth / 2, ry = dock.offsetTop + el.offsetHeight / 3;
      const dx = n.x - rx, dy = n.y - ry, d = Math.hypot(dx, dy) || 1;
      el.style.setProperty("--lx", (dx / d * 3).toFixed(2));
      el.style.setProperty("--ly", (dy / d * 3).toFixed(2));
      el.style.setProperty("--tilt", `${(dx / d) * 6}deg`);
    };

    // A deterministic routine; each beat is short, with calm gaps between.
    const routine: (() => number | Promise<number>)[] = [
      () => { setState("idle"); pulse("is-blink", 160); return 2800; },
      () => { setState("observing"); lookAt("api"); return 2000; },
      () => { setState("idle"); lookAt(null); el.style.setProperty("--tilt", "0deg"); pulse("is-blink", 160); return 3200; },
      () => work(),
      () => { setState("resting"); lookAt(null); el.style.setProperty("--tilt", "0deg"); return 5200; },
      () => { setState("idle"); pulse("is-blink", 160); return 2400; },
      () => { setState("observing"); lookAt("llm"); return 1800; },
      () => { setState("idle"); lookAt(null); el.style.setProperty("--tilt", "0deg"); return 4200; },
    ];
    // WORKING: walk over, send a packet along the first two wires, walk back
    const work = async (): Promise<number> => {
      if (running || selected) return 1000;
      const token = loopToken;
      setState("working");
      el.classList.add("is-walking");
      moveTo(1);
      await wait(1200);
      el.classList.remove("is-walking");
      if (token !== loopToken) return 0;
      lookAt("client");
      if (workCount++ % 2 === 0) say("Checking the connections...");
      const t = runToken;
      await travel("client", "web", t, 700);
      if (token !== loopToken || running || selected) { packet.classList.remove("is-on"); return 0; }
      lookAt("web");
      await travel("web", "api", t, 700);
      packet.classList.remove("is-on");
      if (token !== loopToken) return 0;
      pulse("is-hop", 500);
      await wait(900);
      el.classList.add("is-walking");
      moveTo(0);
      await wait(1200);
      el.classList.remove("is-walking");
      return 600;
    };

    const loop = async (token: number) => {
      let i = 0;
      while (token === loopToken) {
        const ms = await (routine[i++ % routine.length] as () => number | Promise<number>)();
        if (token !== loopToken) return;
        await wait(ms || 0);
      }
    };
    const start = () => { if (reduceMotion || watching || !visible || document.hidden) return; loopToken++; loop(loopToken); };
    const stop = () => { loopToken++; el.classList.remove("is-walking"); };

    if ("IntersectionObserver" in window) {
      new IntersectionObserver(([entry]) => { visible = !!entry?.isIntersecting; if (visible) start(); else stop(); }).observe(dock);
    }
    document.addEventListener("visibilitychange", () => { if (document.hidden) stop(); else start(); });
    window.addEventListener("resize", () => moveTo(x ? 1 : 0));

    // CURIOUS: hover looks toward the pointer, click waves and talks
    const messages = ["Hi! I'm a tiny robot, not a real agent.", "Taking a closer look.", "Found something interesting.", "Back to building."];
    if (finePointer) {
      btn.addEventListener("pointermove", (e) => {
        const r = btn.getBoundingClientRect();
        el.style.setProperty("--lx", Math.max(-3, Math.min(3, (e.clientX - r.left - r.width / 2) / 8)).toFixed(2));
        el.style.setProperty("--ly", Math.max(-3, Math.min(3, (e.clientY - r.top - r.height / 3) / 8)).toFixed(2));
      });
      btn.addEventListener("pointerleave", () => lookAt(null));
    }
    btn.addEventListener("click", () => {
      setState("curious");
      if (!reduceMotion) pulse("is-wave", 900);
      say(messages[clickCount++ % messages.length] as string);
    });

    return {
      lookAt,
      // OBSERVING while a scenario runs: the robot's own routine pauses
      observe(on: boolean) {
        watching = on;
        if (on) { stop(); setState("observing"); el.classList.remove("is-walking"); moveTo(0); }
        else { setState("idle"); lookAt(null); el.style.setProperty("--tilt", "0deg"); start(); }
      },
      celebrate() { if (!reduceMotion) pulse("is-hop", 500); say("Back to building.", 2000); },
    };
  })();
}
