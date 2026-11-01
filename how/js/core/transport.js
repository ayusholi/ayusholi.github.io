// Play, pause, restart, step and speed for any Timeline.
import { $, setText } from "./dom.js";

const ICON = {
  restart: '<path d="M5 4v16M19 5 8 12l11 7z"/>',
  back: '<path d="M18 5 8 12l10 7zM6 5v14"/>',
  play: '<path d="M7 4v16l13-8z"/>',
  pause: '<path d="M7 4h4v16H7zM14 4h4v16h-4z"/>',
  forward: '<path d="M6 5l10 7-10 7zM18 5v14"/>',
};
const icon = (name) => `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">${ICON[name]}</svg>`;
const SPEEDS = [0.5, 1, 2];

export const createTransport = (root, timeline, { label = (tl) => `${tl.cursor}/${tl.frames.length - 1}`, onRestart } = {}) => {
  root.classList.add("transport");
  root.setAttribute("role", "group");
  root.setAttribute("aria-label", "Simulation controls");
  root.innerHTML = `
    <button type="button" class="tbtn" data-t="restart" aria-label="Replay the last action">${icon("restart")}</button>
    <button type="button" class="tbtn" data-t="back" aria-label="Step back">${icon("back")}</button>
    <button type="button" class="tbtn tbtn--main" data-t="toggle" aria-label="Play">${icon("play")}</button>
    <button type="button" class="tbtn" data-t="forward" aria-label="Step forward">${icon("forward")}</button>
    <span class="transport__pos" data-t="pos"></span>
    <span class="transport__speed" role="group" aria-label="Playback speed">
      ${SPEEDS.map((s) => `<button type="button" class="tspeed" data-speed="${s}" aria-pressed="${s === 1}">${s}×</button>`).join("")}
    </span>`;

  const q = (name) => $(`[data-t="${name}"]`, root);
  q("restart").addEventListener("click", () => (onRestart ? onRestart() : timeline.restart()));
  q("back").addEventListener("click", () => timeline.stepBack());
  q("toggle").addEventListener("click", () => timeline.toggle());
  q("forward").addEventListener("click", () => timeline.stepForward());
  root.addEventListener("click", (e) => {
    const b = e.target.closest("[data-speed]");
    if (b) timeline.setSpeed(Number(b.dataset.speed));
  });

  let showingPause = false;
  return {
    update() {
      const playing = timeline.running && !timeline.stepping;
      if (playing !== showingPause) {
        showingPause = playing;
        q("toggle").innerHTML = icon(playing ? "pause" : "play");
        q("toggle").setAttribute("aria-label", playing ? "Pause" : "Play");
      }
      q("back").disabled = timeline.atStart;
      q("restart").disabled = timeline.frames.length < 2;
      setText(q("pos"), label(timeline));
      root.querySelectorAll("[data-speed]").forEach((b) => b.setAttribute("aria-pressed", String(Number(b.dataset.speed) === timeline.speed)));
    },
  };
};
