// The Scrapbook's behaviour, ported from the original script.js. It uses its own
// [data-sb-reveal] / .is-visible, so it never shares state with the portfolio.

export function initScrapbook() {
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // ===== Scroll reveals =====
  const targets = document.querySelectorAll("[data-sb-reveal]");
  const showAll = () => targets.forEach((el) => el.classList.add("is-visible"));
  if (reduceMotion || !("IntersectionObserver" in window)) {
    showAll();
  } else {
    // Trigger as soon as a sliver is on screen, so nothing sits blank while it's being read
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      });
    }, { rootMargin: "0px 0px -6% 0px", threshold: 0 });
    targets.forEach((el) => observer.observe(el));
    // Printing (or saving as PDF) shouldn't capture sections that were never scrolled to
    window.addEventListener("beforeprint", showAll);
    // Reaching the end of the page reveals anything still waiting, so the closing
    // sections are never left blank (e.g. by a quick jump or a full-page capture)
    const revealAtEnd = () => {
      if (window.innerHeight + window.scrollY < document.documentElement.scrollHeight - 4) return;
      showAll();
      window.removeEventListener("scroll", revealAtEnd);
    };
    window.addEventListener("scroll", revealAtEnd, { passive: true });
  }

  // ===== Field notes: "More" toggles =====
  // The extra paragraph is visible by default; JS reveals the buttons and collapses it.
  document.querySelectorAll<HTMLElement>(".note__toggle").forEach((btn) => {
    const note = btn.closest(".note") as HTMLElement;
    btn.hidden = false;
    btn.addEventListener("click", () => {
      const open = btn.getAttribute("aria-expanded") !== "true";
      btn.setAttribute("aria-expanded", String(open));
      (btn.firstChild as ChildNode).textContent = open ? "Less " : "More ";
      note.classList.toggle("is-open", open);
    });
  });

  // ===== Remote image fallback =====
  // If an image can't load, keep its frame and label the gap instead of a broken-image icon
  const markMissing = (img: HTMLImageElement) => img.closest(".frame")?.classList.add("is-missing");
  document.querySelectorAll<HTMLImageElement>(".scrapbook .frame img").forEach((img) => {
    if (img.complete && img.naturalWidth === 0) markMissing(img);
    else img.addEventListener("error", () => markMissing(img), { once: true });
  });
}
