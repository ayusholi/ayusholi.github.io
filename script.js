// ===== Theme toggle =====
const root = document.documentElement;
const toggle = document.getElementById("theme-toggle");

toggle.addEventListener("click", () => {
  const next = root.getAttribute("data-theme") === "dark" ? "light" : "dark";
  root.setAttribute("data-theme", next);
  try { localStorage.setItem("theme", next); } catch (e) {}
});

// ===== Footer year =====
document.getElementById("year").textContent = new Date().getFullYear();

// ===== Capability flags =====
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
const canAnimate = "IntersectionObserver" in window && !reduceMotion;

// Hidden "before" states in the CSS only exist under .js-anim, so the page is
// fully readable without JS or with reduced motion.
if (canAnimate) root.classList.add("js-anim");

// ===== Hero: split the name into letters =====
const heroName = document.getElementById("hero-name");
const letters = [];
let letterIndex = 0;
heroName.querySelectorAll("[data-split]").forEach((word) => {
  const text = word.textContent.trim();
  word.textContent = "";
  word.setAttribute("aria-hidden", "true");
  for (const char of text) {
    const mask = document.createElement("span");
    mask.className = "ch";
    const inner = document.createElement("span");
    inner.className = "ch__in";
    inner.textContent = char;
    inner.style.setProperty("--i", letterIndex++);
    mask.appendChild(inner);
    word.appendChild(mask);
    letters.push({ el: inner, x: 0, y: 0 });
  }
});
// once the entrance has played, let letters lift above their masks
setTimeout(() => heroName.classList.add("is-done"), canAnimate ? 1700 : 0);

// ===== Scroll reveals =====
if (canAnimate) {
  // Hero items follow the headline in a fixed sequence
  document.querySelectorAll(".hero [data-reveal]").forEach((el, i) => {
    el.style.setProperty("--d", `${0.55 + i * 0.12}s`);
  });
  // Siblings inside a [data-stagger] group, and gallery columns, cascade
  document.querySelectorAll("[data-stagger]").forEach((group) => {
    group.querySelectorAll("[data-reveal]").forEach((el, i) => el.style.setProperty("--d", `${i * 0.09}s`));
  });
  document.querySelectorAll(".gallery .photo").forEach((el, i) => el.style.setProperty("--d", `${(i % 4) * 0.08}s`));
  document.querySelectorAll(".work .project").forEach((el, i) => el.style.setProperty("--d", `${(i % 2) * 0.1}s`));

  const revealObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      const el = entry.target;
      el.classList.add("is-in");
      revealObserver.unobserve(el);
      // After the entrance, hand transitions back to the element's own hover timing
      const delay = parseFloat(el.style.getPropertyValue("--d")) || 0;
      setTimeout(() => el.classList.add("is-settled"), (delay + 1.1) * 1000);
    });
  }, { threshold: 0.12, rootMargin: "0px 0px -6% 0px" });

  document.querySelectorAll("[data-reveal], [data-mask]").forEach((el) => revealObserver.observe(el));
}

// ===== Hero: pointer-reactive grid + letters =====
const hero = document.querySelector(".hero");
const heroGrid = document.querySelector(".hero__grid");

if (finePointer && !reduceMotion) {
  let px = 0, py = 0, queued = false;

  const measure = () => {
    letters.forEach((l) => {
      const r = l.el.getBoundingClientRect();
      l.x = r.left + r.width / 2 + window.scrollX;
      l.y = r.top + r.height / 2 + window.scrollY;
      l.size = r.height;
    });
  };
  const frame = () => {
    queued = false;
    const g = heroGrid.getBoundingClientRect();
    hero.style.setProperty("--mx", `${px - g.left}px`);
    hero.style.setProperty("--my", `${py - g.top}px`);
    const ax = px + window.scrollX, ay = py + window.scrollY;
    letters.forEach((l) => {
      const reach = Math.max(180, l.size * 0.9);
      const near = Math.max(0, 1 - Math.hypot(ax - l.x, ay - l.y) / reach);
      l.el.style.setProperty("--near", near.toFixed(2));
      l.el.style.setProperty("--y", (near * l.size * 0.08).toFixed(1));
      l.el.style.setProperty("--r", ((ax < l.x ? -1 : 1) * near * 4).toFixed(1));
    });
  };
  hero.addEventListener("pointermove", (e) => {
    px = e.clientX; py = e.clientY;
    hero.classList.add("is-pointer");
    if (!queued) { queued = true; requestAnimationFrame(frame); }
  });
  hero.addEventListener("pointerleave", () => {
    hero.classList.remove("is-pointer");
    letters.forEach((l) => {
      l.el.style.setProperty("--near", 0);
      l.el.style.setProperty("--y", 0);
      l.el.style.setProperty("--r", 0);
    });
  });
  // letter positions only change with layout; re-measure on resize / font load
  window.addEventListener("resize", measure);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(measure);
  window.addEventListener("load", measure);
  setTimeout(measure, 1800);
}

// ===== Project preview tilt (feature card only) =====
document.querySelectorAll("[data-tilt]").forEach((preview) => {
  if (!finePointer || reduceMotion) return;
  const card = preview.closest(".project");
  card.addEventListener("pointermove", (e) => {
    const r = preview.getBoundingClientRect();
    const dx = (e.clientX - r.left) / r.width - 0.5;
    const dy = (e.clientY - r.top) / r.height - 0.5;
    preview.style.transform = `perspective(900px) rotateY(${(dx * 5).toFixed(2)}deg) rotateX(${(-dy * 5).toFixed(2)}deg)`;
  });
  card.addEventListener("pointerleave", () => { preview.style.transform = ""; });
});

// ===== Nav: scrolled state, progress bar, timeline fill (one rAF-throttled handler) =====
const nav = document.getElementById("nav");
const bar = document.getElementById("progress-bar");
const timeline = document.getElementById("timeline");
const timelineFill = document.getElementById("timeline-fill");
let ticking = false;

const onScroll = () => {
  ticking = false;
  const max = document.documentElement.scrollHeight - window.innerHeight;
  bar.style.transform = `scaleX(${max > 0 ? Math.min(1, window.scrollY / max) : 0})`;
  nav.classList.toggle("is-scrolled", window.scrollY > 10);
  if (timeline) {
    const r = timeline.getBoundingClientRect();
    const p = (window.innerHeight * 0.6 - r.top) / r.height;
    timelineFill.style.transform = `scaleY(${Math.min(1, Math.max(0, p))})`;
  }
};
window.addEventListener("scroll", () => {
  if (!ticking) { ticking = true; requestAnimationFrame(onScroll); }
}, { passive: true });
window.addEventListener("resize", onScroll);
onScroll();

// ===== Nav: active-section indicator =====
const navLinks = document.getElementById("nav-links");
const indicator = navLinks.querySelector(".nav__indicator");
const links = [...navLinks.querySelectorAll("a")];
let activeLink = null;

const placeIndicator = () => {
  if (!activeLink || getComputedStyle(indicator).display === "none") { indicator.style.opacity = 0; return; }
  indicator.style.opacity = 1;
  indicator.style.width = `${activeLink.offsetWidth}px`;
  indicator.style.transform = `translateX(${activeLink.offsetLeft}px)`;
};
const setActive = (id) => {
  activeLink = links.find((a) => a.getAttribute("href") === `#${id}`) || null;
  links.forEach((a) => {
    const on = a === activeLink;
    a.classList.toggle("is-active", on);
    if (on) a.setAttribute("aria-current", "true"); else a.removeAttribute("aria-current");
  });
  placeIndicator();
};
if ("IntersectionObserver" in window) {
  const sectionObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => { if (entry.isIntersecting) setActive(entry.target.id === "top" ? "" : entry.target.id); });
  }, { rootMargin: "-45% 0px -50% 0px" });
  document.querySelectorAll("main > section[id]").forEach((s) => sectionObserver.observe(s));
}
window.addEventListener("resize", placeIndicator);

// ===== Mobile menu =====
const menuToggle = document.getElementById("menu-toggle");
const setMenu = (open) => {
  navLinks.classList.toggle("is-open", open);
  menuToggle.setAttribute("aria-expanded", String(open));
  menuToggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
};
menuToggle.addEventListener("click", () => setMenu(menuToggle.getAttribute("aria-expanded") !== "true"));
links.forEach((a) => a.addEventListener("click", () => setMenu(false)));
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && menuToggle.getAttribute("aria-expanded") === "true") { setMenu(false); menuToggle.focus(); }
});
window.matchMedia("(min-width: 901px)").addEventListener("change", (e) => { if (e.matches) setMenu(false); });
