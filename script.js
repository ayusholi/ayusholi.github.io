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

// ===== Animations (later) =====
// Every section has a [data-animate] attribute, ready for scroll-in
// animations (e.g. IntersectionObserver or GSAP) when you add them.
