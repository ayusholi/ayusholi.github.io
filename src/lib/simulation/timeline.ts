// =========================================================
// Timeline: plays the frames a simulation produces.
//
// A simulation never animates anything. It is a set of pure
// functions that turn a state into a list of frames, where each
// frame holds the full state *after* one meaningful transition.
// The timeline walks those frames and tells the view how far
// through the current one it is, so what is drawn can only ever
// be what the simulation said happened.
//
// Rewinding is view-only: `cursor` moves through history, but new
// actions always apply to the newest state ("the present").
// =========================================================

import type { SimFrame } from "./simulation-types";

const MAX_FRAMES = 600;

type Raf = (callback: FrameRequestCallback) => number;

export type TimelineOptions<F> = {
  initial: F;
  // Frames to run when the queue is empty, for systems that keep going by themselves.
  generate?: (state: StateOf<F>) => F[] | null;
  // Pass null to drive the timeline by hand with advance(), as the tests do.
  raf?: Raf | null;
};

type StateOf<F> = F extends SimFrame<infer S> ? S : never;

export class Timeline<F extends SimFrame<unknown>> {
  frames: F[];
  cursor = 0;
  t = 1;
  speed = 1;
  running = false;       // the visitor wants it to play
  suspended = false;     // off-screen or hidden: no work, but `running` is kept
  stepping = false;      // playing a single frame, then stopping
  instant = true;        // the current frame was landed on, not played into
  traceStart = 0;        // first frame of the latest action, for Restart

  private generate: ((state: StateOf<F>) => F[] | null) | null;
  private raf: Raf | null;
  private rafId = 0;
  private lastTime = 0;
  private version = 0;
  private listeners = new Set<() => void>();
  private progressListener: (t: number, frame: F) => void = () => {};

  constructor({ initial, generate, raf }: TimelineOptions<F>) {
    this.frames = [initial];
    this.generate = generate ?? null;
    this.raf = raf === undefined ? (globalThis.requestAnimationFrame?.bind(globalThis) ?? null) : raf;
  }

  // ---------- Subscriptions ----------
  // React reads the timeline as an external store, once per frame change.
  // `t` changes on every animation frame, so it goes to a direct listener
  // and never causes a render.
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  };
  getVersion = () => this.version;
  onProgress(listener: (t: number, frame: F) => void) {
    this.progressListener = listener;
    return () => { this.progressListener = () => {}; };
  }
  private notify() {
    this.version++;
    this.listeners.forEach((l) => l());
  }

  private loop = (now: number) => {
    this.rafId = 0;
    if (!this.running || this.suspended) return;
    const dt = this.lastTime ? Math.min(100, now - this.lastTime) : 16;
    this.lastTime = now;
    this.advance(dt);
    if (this.running && !this.suspended && this.raf) this.rafId = this.raf(this.loop);
  };

  get frame(): F { return this.frames[this.cursor] as F; }
  get present(): StateOf<F> { return (this.frames[this.frames.length - 1] as F).state as StateOf<F>; }
  get atEnd() { return this.cursor >= this.frames.length - 1; }
  get atStart() { return this.cursor <= 0; }

  // Append the frames of an action. `animate: false` lands on them at once.
  push(frames: F[], { animate = true, restart = true } = {}) {
    if (!frames.length) return;
    const wasIdle = this.atEnd && this.t >= 1;
    const start = this.frames.length;
    this.frames.push(...frames);
    if (restart) this.traceStart = start;
    if (!animate) {
      this.cursor = this.frames.length - 1;
      this.t = 1;
      this.instant = true;
      this.progressListener(1, this.frame);
    } else if (wasIdle) {
      this.enter(start);
      this.play();
    } else {
      this.play();
    }
    this.trim();
    this.notify();
  }

  // Replace everything: used by Reset and by scenario presets.
  reset(initial: F) {
    this.running = false;
    this.stepping = false;
    this.frames = [initial];
    this.cursor = 0;
    this.traceStart = 0;
    this.t = 1;
    this.instant = true;
    this.progressListener(1, initial);
    this.notify();
  }

  trim() {
    const excess = this.frames.length - MAX_FRAMES;
    if (excess <= 0 || this.cursor < excess) return;
    this.frames.splice(0, excess);
    this.cursor -= excess;
    this.traceStart = Math.max(0, this.traceStart - excess);
  }

  private enter(index: number, instant = false) {
    this.cursor = index;
    this.t = instant ? 1 : 0;
    this.instant = instant;
    this.notify();
    this.progressListener(this.t, this.frame);
  }

  // Move time forward by dt milliseconds of wall clock.
  advance(dt: number) {
    if (!this.running) return;
    const frame = this.frame;
    const dur = (frame.dur || 1) / this.speed;
    this.t = Math.min(1, this.t + dt / dur);
    this.progressListener(this.t, frame);
    if (this.t < 1) return;

    if (this.stepping) {
      this.stepping = false;
      this.pause();
    } else if (!this.atEnd) {
      this.enter(this.cursor + 1);
    } else {
      const more = this.generate ? this.generate(this.present) : null;
      if (more && more.length) {
        const start = this.frames.length;
        this.frames.push(...more);
        this.enter(start);
        this.trim();
      } else if (!this.generate) {
        this.pause();
      }
      // With a generator and nothing to do, stay "running" and wait for work.
    }
  }

  play() {
    if (this.running) return this.kick();
    this.running = true;
    this.lastTime = 0;
    this.kick();
    this.notify();
  }

  private kick() {
    if (this.raf && !this.rafId && !this.suspended) this.rafId = this.raf(this.loop);
  }

  pause() {
    if (!this.running && !this.stepping) return;
    this.running = false;
    this.stepping = false;
    this.notify();
  }

  toggle() {
    if (this.running) return this.pause();
    // Pressing play on a finished trace replays it, like any other player.
    if (!this.generate && this.atEnd && this.t >= 1) return this.restart();
    this.play();
  }

  stepForward() {
    this.pause();
    if (this.atEnd) {
      const more = this.generate ? this.generate(this.present) : null;
      if (!more || !more.length) return;
      this.frames.push(...more);
      this.trim();
    }
    this.enter(this.cursor + 1);
    this.stepping = true;
    this.running = true;
    this.lastTime = 0;
    this.kick();
    this.notify();
  }

  stepBack() {
    this.pause();
    if (this.atStart) return;
    this.enter(this.cursor - 1, true);
  }

  restart() {
    this.pause();
    this.enter(this.traceStart);
    this.play();
  }

  // Land on the newest frame without animating.
  jumpToEnd() {
    if (this.atEnd && this.t >= 1) return;
    this.pause();
    this.enter(this.frames.length - 1, true);
  }

  setSpeed(speed: number) {
    this.speed = speed;
    this.notify();
  }

  // Off-screen or hidden tab: stop spending frames, keep the visitor's intent.
  suspend(on: boolean) {
    this.suspended = on;
    if (on) { this.lastTime = 0; return; }
    if (this.running) this.kick();
  }

  // Stops the animation loop. Safe to call more than once, and the timeline
  // can start again afterwards, which React's Strict Mode remount relies on.
  dispose() {
    this.running = false;
    this.stepping = false;
    this.lastTime = 0;
    if (this.rafId) globalThis.cancelAnimationFrame?.(this.rafId);
    this.rafId = 0;
  }
}
