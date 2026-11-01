// One small drawing per topic. Each shows the topic's actual mechanism in
// miniature, drawn on a 200×120 sheet in currentColor. `.sig` marks the moving
// part, which takes the signal colour; live topics animate it in CSS.

const svg = (body) => `<svg viewBox="0 0 200 120" fill="none" stroke="currentColor" stroke-width="1.2" aria-hidden="true" focusable="false">${body}</svg>`;
const range = (n) => Array.from({ length: n }, (_, i) => i);

export const PREVIEWS = {
  // A short path that returns, above a long one that goes all the way down
  redis: svg(`
    <rect x="8" y="46" width="34" height="28"/><rect x="82" y="46" width="34" height="28"/>
    <rect x="156" y="10" width="36" height="28"/><rect x="156" y="82" width="36" height="28"/>
    ${range(3).map((i) => `<path d="M${162 + i * 9} 18v12"/>`).join("")}
    <path d="M42 60h40M116 54h20v-30h20M116 66h20v30h20"/>
    <path class="sig sig--a" d="M42 60h40M116 54h20v-30h20" pathLength="100"/>
  `),
  // Tapes of different length, each read at its own position
  kafka: svg(`
    ${range(3).map((r) => {
      const y = 20 + r * 34, n = [11, 8, 13][r], read = [7, 3, 10][r];
      return `<path d="M6 ${y + 20}h188" opacity=".3"/>` + range(n).map((i) =>
        `<rect x="${8 + i * 14}" y="${y}" width="12" height="16" ${i < read ? 'fill="currentColor" fill-opacity=".22"' : ""}/>`).join("") +
        `<path class="sig sig--b" style="animation-delay:${r * -0.7}s" d="M${8 + read * 14} ${y - 4}v24" stroke-width="2"/>`;
    }).join("")}
  `),
  // A sentence broken into tokens, the next one still forming
  llms: svg(`
    ${[[6, 34], [44, 22], [70, 46], [120, 28]].map(([x, w]) => `<rect x="${x}" y="48" width="${w}" height="22"/>`).join("")}
    <rect class="sig" x="152" y="48" width="40" height="22" stroke-dasharray="3 3"/>
    ${[10, 30, 22, 6].map((h, i) => `<path d="M${156 + i * 11} 92v${h / 1.4}"/>`).join("")}
    <path d="M6 80h186" opacity=".3"/>
  `),
  // Layers shared underneath, isolated boxes on top
  docker: svg(`
    ${range(3).map((i) => `<rect x="${14 + i * 60}" y="16" width="52" height="46"/><path d="M${14 + i * 60} 30h52"/>`).join("")}
    <path d="M6 72h188M6 86h188M6 100h188"/><text x="8" y="115" font-size="9" fill="currentColor" stroke="none">one shared kernel</text>
  `),
  // Three wanted, two running, one being replaced
  kubernetes: svg(`
    <circle cx="100" cy="60" r="44" stroke-dasharray="2 4"/>
    ${[[100, 16], [62, 82], [138, 82]].map(([x, y]) => `<rect x="${x - 14}" y="${y - 14}" width="28" height="28"/>`).join("")}
    <path class="sig" d="M128 68l20 28M148 68l-20 28"/>
    <path d="M152 30a44 44 0 0 1 -8 30" /><path d="M144 60l-2-8M144 60l7-5"/>
  `),
  // Documents scored, the top few passed on
  rag: svg(`
    ${range(5).map((i) => `<rect x="${10 + i * 3}" y="${12 + i * 19}" width="66" height="14" ${i < 2 ? 'fill="currentColor" fill-opacity=".2"' : ""}/>`).join("")}
    <path d="M84 22h34v28M90 41h28"/><rect x="118" y="50" width="72" height="44"/><path d="M128 64h52M128 74h52M128 84h30"/>
  `),
  // A tree descending to one row
  databases: svg(`
    <rect x="84" y="8" width="32" height="16"/>
    ${[36, 132].map((x) => `<rect x="${x}" y="48" width="32" height="16"/>`).join("")}
    <path d="M100 24L52 48M100 24l48 24"/>
    ${[8, 48, 104, 144].map((x) => `<rect x="${x}" y="92" width="30" height="16"/>`).join("")}
    <path d="M52 64L23 92M52 64l11 28M148 64l-29 28M148 64l11 28"/>
  `),
  // Model, tool, result, model: a loop with a visible turn
  "ai-agents": svg(`
    <circle cx="44" cy="60" r="24"/><rect x="128" y="20" width="58" height="22"/><rect x="128" y="50" width="58" height="22"/><rect x="128" y="80" width="58" height="22"/>
    <path d="M68 52c26-4 34-14 60-20M128 40c-22 8-30 14-60 22"/>
    <path class="sig" d="M68 66h60" stroke-dasharray="3 3"/>
  `),
  // One worker fanning across many connections
  nginx: svg(`
    <rect x="12" y="44" width="40" height="32"/>
    ${range(8).map((i) => `<path d="M52 60C100 60 90 ${10 + i * 14} 150 ${10 + i * 14}"/><rect x="150" y="${6 + i * 14}" width="8" height="8"/>`).join("")}
  `),
  // Stages in a line, one failing
  "ci-cd": svg(`
    ${range(4).map((i) => `<rect x="${6 + i * 49}" y="46" width="38" height="28"/>`).join("")}
    ${range(3).map((i) => `<path d="M${44 + i * 49} 60h11"/>`).join("")}
    <path class="sig" d="M104 52l18 16M122 52l-18 16"/>
    <path d="M6 96h60M6 96l6-4M6 96l6 4" opacity=".6"/>
  `),
  // Branching workflow graph
  "github-actions": svg(`
    <circle cx="20" cy="60" r="8"/>
    <rect x="62" y="20" width="44" height="18"/><rect x="62" y="51" width="44" height="18"/><rect x="62" y="82" width="44" height="18"/>
    <rect x="146" y="51" width="44" height="18"/>
    <path d="M28 60c20 0 14-31 34-31M28 60h34M28 60c20 0 14 31 34 31M106 29c20 0 20 31 40 31M106 60h40M106 91c20 0 20-31 40-31"/>
  `),
};
