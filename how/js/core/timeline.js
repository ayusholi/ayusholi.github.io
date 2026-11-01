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

const MAX_FRAMES = 600;

export class Timeline {
  // onFrame(frame, { instant })  a new frame became current
  // onProgress(frame, t)         t runs 0..1 across the frame
  // onChange(timeline)           transport state changed (for controls)
  // generate(state)              optional: frames to run when the queue is empty
  constructor({ initial, onFrame, onProgress, onChange, generate, raf }) {
    this.frames = [initial];
    this.cursor = 0;
    this.t = 1;
    this.speed = 1;
    this.running = false;    // the visitor wants it to play
    this.suspended = false;  // off-screen or hidden: no work, but `running` is kept
    this.traceStart = 0;     // first frame of the latest action, for Restart
    this.onFrame = onFrame || (() => {});
    this.onProgress = onProgress || (() => {});
    this.onChange = onChange || (() => {});
    this.generate = generate || null;
    this.raf = raf === undefined ? (globalThis.requestAnimationFrame?.bind(globalThis) || null) : raf;
    this.rafId = 0;
    this.lastTime = 0;
    this.loop = (now) => {
      this.rafId = 0;
      if (!this.running || this.suspended) return;
      const dt = this.lastTime ? Math.min(100, now - this.lastTime) : 16;
      this.lastTime = now;
      this.advance(dt);
      if (this.running && !this.suspended && this.raf) this.rafId = this.raf(this.loop);
    };
  }

  get frame() { return this.frames[this.cursor]; }
  get present() { return this.frames[this.frames.length - 1].state; }
  get atEnd() { return this.cursor >= this.frames.length - 1; }
  get atStart() { return this.cursor <= 0; }

  // Append the frames of an action. `animate: false` lands on them at once.
  push(frames, { animate = true, restart = true } = {}) {
    if (!frames.length) return;
    const wasIdle = this.atEnd && this.t >= 1;
    const start = this.frames.length;
    this.frames.push(...frames);
    if (restart) this.traceStart = start;
    if (!animate) {
      this.cursor = this.frames.length - 1;
      this.t = 1;
      this.onFrame(this.frame, { instant: true });
      this.onProgress(this.frame, 1);
    } else if (wasIdle) {
      this.enter(start);
      this.play();
    } else {
      this.play();
    }
    this.trim();
    this.onChange(this);
  }

  // Replace everything: used by Reset and by scenario presets.
  reset(initial) {
    this.pause();
    this.frames = [initial];
    this.cursor = 0;
    this.traceStart = 0;
    this.t = 1;
    this.onFrame(initial, { instant: true });
    this.onProgress(initial, 1);
    this.onChange(this);
  }

  trim() {
    const excess = this.frames.length - MAX_FRAMES;
    if (excess <= 0 || this.cursor < excess) return;
    this.frames.splice(0, excess);
    this.cursor -= excess;
    this.traceStart = Math.max(0, this.traceStart - excess);
  }

  enter(index, instant = false) {
    this.cursor = index;
    this.t = instant ? 1 : 0;
    this.onFrame(this.frame, { instant });
    this.onProgress(this.frame, this.t);
  }

  // Move time forward by dt milliseconds of wall clock.
  advance(dt) {
    if (!this.running) return;
    const frame = this.frame;
    const dur = (frame.dur || 1) / this.speed;
    this.t = Math.min(1, this.t + dt / dur);
    this.onProgress(frame, this.t);
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
    this.onChange(this);
  }

  kick() {
    if (this.raf && !this.rafId && !this.suspended) this.rafId = this.raf(this.loop);
  }

  pause() {
    if (!this.running && !this.stepping) return;
    this.running = false;
    this.stepping = false;
    this.onChange(this);
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
    this.onChange(this);
  }

  stepBack() {
    this.pause();
    if (this.atStart) return;
    this.enter(this.cursor - 1, true);
    this.onChange(this);
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
    this.onChange(this);
  }

  setSpeed(speed) {
    this.speed = speed;
    this.onChange(this);
  }

  // Off-screen or hidden tab: stop spending frames, keep the visitor's intent.
  suspend(on) {
    this.suspended = on;
    if (on) { this.lastTime = 0; return; }
    if (this.running) this.kick();
  }
}
