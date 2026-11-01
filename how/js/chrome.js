// Runs on every page of the publication: the configurable name, entrance
// reveals, and (on topic pages) links to related topics.
import { PUBLICATION } from "./config.js";
import { topicBySlug, collectionById } from "./topics.js";
import { PREVIEWS } from "./previews.js";
import { $, $$, reducedMotion } from "./core/dom.js";

$$("[data-pub-name]").forEach((el) => { el.textContent = PUBLICATION.name; });
document.title = document.title.replace("How Things Work", PUBLICATION.name);

const year = $("#year");
if (year) year.textContent = new Date().getFullYear();

// Hidden "before" states only exist under .js-in, so nothing depends on this.
const reveals = $$("[data-in]");
if (!reducedMotion() && "IntersectionObserver" in window) {
  document.documentElement.classList.add("js-in");
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (!e.isIntersecting) return;
      e.target.classList.add("is-in");
      io.unobserve(e.target);
    });
  }, { rootMargin: "0px 0px -6% 0px" });
  reveals.forEach((el) => io.observe(el));
}

// Related topics, drawn from the registry so pages never list a dead link.
const related = $("#related");
if (related) {
  const topic = topicBySlug(related.dataset.topic);
  related.innerHTML = topic.related.map((slug) => {
    const t = topicBySlug(slug);
    const body = `
      <span class="next__art">${PREVIEWS[slug]}</span>
      <span class="label">${collectionById(t.collection).title}</span>
      <strong class="next__title">${t.title}</strong>
      <span class="next__q">${t.question}</span>
      <span class="label next__state">${t.status === "live" ? `Interactive · ${t.minutes} min →` : "On the drawing board"}</span>`;
    return t.status === "live"
      ? `<a class="next" href="../${slug}/">${body}</a>`
      : `<div class="next next--planned">${body}</div>`;
  }).join("");
}
