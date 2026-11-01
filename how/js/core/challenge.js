// A small "predict what happens" check. `verdict(index)` runs when a choice
// is made, so a topic can compute the explanation from its simulation rather
// than storing a canned answer.
import { $, $$ } from "./dom.js";

export const createChallenge = (root, { question, options, answer, verdict, watch }) => {
  root.innerHTML = `
    <p class="challenge__q">${question}</p>
    <div class="challenge__opts" role="group" aria-label="Choose an answer">
      ${options.map((o, i) => `<button type="button" class="opt" data-i="${i}"><span class="opt__key" aria-hidden="true">${"ABCD"[i]}</span><span>${o}</span><span class="opt__mark" aria-hidden="true"></span></button>`).join("")}
    </div>
    <div class="challenge__out" role="status" hidden></div>`;
  const out = $(".challenge__out", root);

  root.addEventListener("click", (e) => {
    const btn = e.target.closest(".opt");
    if (btn) {
      const i = Number(btn.dataset.i), right = i === answer;
      $$(".opt", root).forEach((b, n) => {
        b.classList.remove("is-right", "is-wrong");
        $(".opt__mark", b).textContent = "";
        if (n === answer) { b.classList.add("is-right"); $(".opt__mark", b).textContent = "✓ correct"; }
        else if (n === i) { b.classList.add("is-wrong"); $(".opt__mark", b).textContent = "✕ your pick"; }
      });
      out.hidden = false;
      out.innerHTML = `<p><strong>${right ? "Yes." : "Not quite."}</strong> ${verdict(i)}</p>${watch ? `<button type="button" class="btn" data-watch>${watch.label}</button>` : ""}`;
    }
    if (e.target.closest("[data-watch]")) watch.run();
  });
};
