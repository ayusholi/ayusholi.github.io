// Small helpers shared by every bench.

export const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
export const reducedMotion = () => motionQuery.matches;

export const $ = (selector, root = document) => root.querySelector(selector);
export const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

export const escapeHtml = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

// Only touch the DOM when text really changes: benches re-render every frame.
export const setText = (el, text) => { if (el.textContent !== String(text)) el.textContent = text; };

// Marks one button in a group as chosen, and keeps aria-pressed in step.
export const segmented = (root, value) => {
  $$("[data-value]", root).forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.value === String(value))));
};

export const onSegment = (root, handler) => {
  root.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-value]");
    if (btn) handler(btn.dataset.value, btn);
  });
};

// A simulation only runs while it can be seen.
export const pauseWhenHidden = (el, timeline) => {
  let onScreen = false;
  const sync = () => timeline.suspend(!onScreen || document.hidden);
  new IntersectionObserver(([entry]) => { onScreen = entry.isIntersecting; sync(); }, { threshold: 0.05 }).observe(el);
  document.addEventListener("visibilitychange", sync);
  sync();
};

// ← → step, Space plays. Ignored while typing or on a control with its own keys.
export const transportKeys = (el, timeline) => {
  el.addEventListener("keydown", (e) => {
    if (e.target.closest("input, select, textarea")) return;
    if (e.key === "ArrowRight") { e.preventDefault(); timeline.stepForward(); }
    else if (e.key === "ArrowLeft") { e.preventDefault(); timeline.stepBack(); }
    else if (e.key === " " && !e.target.closest("button, a, summary")) { e.preventDefault(); timeline.toggle(); }
  });
};
