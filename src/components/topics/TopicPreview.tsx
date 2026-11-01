import type { JSX } from "react";

// One small drawing per topic, showing its actual mechanism in miniature on a
// 200×120 sheet in currentColor. `.sig` marks the moving part, which takes the
// signal colour; live topics animate it in CSS.
const range = (n: number) => Array.from({ length: n }, (_, i) => i);
const FILL = { fill: "currentColor", fillOpacity: 0.2 };

const redis = (
  <>
    <rect x="8" y="46" width="34" height="28" /><rect x="82" y="46" width="34" height="28" />
    <rect x="156" y="10" width="36" height="28" /><rect x="156" y="82" width="36" height="28" />
    {range(3).map((i) => <path key={i} d={`M${162 + i * 9} 18v12`} />)}
    <path d="M42 60h40M116 54h20v-30h20M116 66h20v30h20" />
    <path className="sig sig--a" d="M42 60h40M116 54h20v-30h20" pathLength={100} />
  </>
);

const kafka = (
  <>
    {range(3).map((r) => {
      const y = 20 + r * 34, n = [11, 8, 13][r] as number, read = [7, 3, 10][r] as number;
      return (
        <g key={r}>
          <path d={`M6 ${y + 20}h188`} opacity=".3" />
          {range(n).map((i) => <rect key={i} x={8 + i * 14} y={y} width="12" height="16" {...(i < read ? { fill: "currentColor", fillOpacity: 0.22 } : {})} />)}
          <path className="sig sig--b" style={{ animationDelay: `${r * -0.7}s` }} d={`M${8 + read * 14} ${y - 4}v24`} strokeWidth="2" />
        </g>
      );
    })}
  </>
);

const llms = (
  <>
    {[[6, 34], [44, 22], [70, 46], [120, 28]].map(([x, w]) => <rect key={x} x={x} y="48" width={w} height="22" />)}
    <rect className="sig" x="152" y="48" width="40" height="22" strokeDasharray="3 3" />
    {[10, 30, 22, 6].map((h, i) => <path key={i} d={`M${156 + i * 11} 92v${h / 1.4}`} />)}
    <path d="M6 80h186" opacity=".3" />
  </>
);

const docker = (
  <>
    {range(3).map((i) => <g key={i}><rect x={14 + i * 60} y="16" width="52" height="46" /><path d={`M${14 + i * 60} 30h52`} /></g>)}
    <path d="M6 72h188M6 86h188M6 100h188" />
    <text x="8" y="115" fontSize="9" fill="currentColor" stroke="none">one shared kernel</text>
  </>
);

const kubernetes = (
  <>
    <circle cx="100" cy="60" r="44" strokeDasharray="2 4" />
    {[[100, 16], [62, 82], [138, 82]].map(([x, y]) => <rect key={x} x={(x as number) - 14} y={(y as number) - 14} width="28" height="28" />)}
    <path className="sig" d="M128 68l20 28M148 68l-20 28" />
    <path d="M152 30a44 44 0 0 1 -8 30" /><path d="M144 60l-2-8M144 60l7-5" />
  </>
);

const rag = (
  <>
    {range(5).map((i) => <rect key={i} x={10 + i * 3} y={12 + i * 19} width="66" height="14" {...(i < 2 ? FILL : {})} />)}
    <path d="M84 22h34v28M90 41h28" /><rect x="118" y="50" width="72" height="44" /><path d="M128 64h52M128 74h52M128 84h30" />
  </>
);

const databases = (
  <>
    <rect x="84" y="8" width="32" height="16" />
    {[36, 132].map((x) => <rect key={x} x={x} y="48" width="32" height="16" />)}
    <path d="M100 24L52 48M100 24l48 24" />
    {[8, 48, 104, 144].map((x) => <rect key={x} x={x} y="92" width="30" height="16" />)}
    <path d="M52 64L23 92M52 64l11 28M148 64l-29 28M148 64l11 28" />
  </>
);

const agents = (
  <>
    <circle cx="44" cy="60" r="24" /><rect x="128" y="20" width="58" height="22" /><rect x="128" y="50" width="58" height="22" /><rect x="128" y="80" width="58" height="22" />
    <path d="M68 52c26-4 34-14 60-20M128 40c-22 8-30 14-60 22" />
    <path className="sig" d="M68 66h60" strokeDasharray="3 3" />
  </>
);

const nginx = (
  <>
    <rect x="12" y="44" width="40" height="32" />
    {range(8).map((i) => <g key={i}><path d={`M52 60C100 60 90 ${10 + i * 14} 150 ${10 + i * 14}`} /><rect x="150" y={6 + i * 14} width="8" height="8" /></g>)}
  </>
);

const cicd = (
  <>
    {range(4).map((i) => <rect key={i} x={6 + i * 49} y="46" width="38" height="28" />)}
    {range(3).map((i) => <path key={i} d={`M${44 + i * 49} 60h11`} />)}
    <path className="sig" d="M104 52l18 16M122 52l-18 16" />
    <path d="M6 96h60M6 96l6-4M6 96l6 4" opacity=".6" />
  </>
);

const actions = (
  <>
    <circle cx="20" cy="60" r="8" />
    <rect x="62" y="20" width="44" height="18" /><rect x="62" y="51" width="44" height="18" /><rect x="62" y="82" width="44" height="18" />
    <rect x="146" y="51" width="44" height="18" />
    <path d="M28 60c20 0 14-31 34-31M28 60h34M28 60c20 0 14 31 34 31M106 29c20 0 20 31 40 31M106 60h40M106 91c20 0 20-31 40-31" />
  </>
);

const DRAWINGS: Record<string, JSX.Element> = {
  redis, "apache-kafka": kafka, llms, docker, kubernetes, rag, databases, "ai-agents": agents, nginx, "ci-cd": cicd, "github-actions": actions,
};

export const TopicPreview = ({ slug }: { slug: string }) => {
  const drawing = DRAWINGS[slug];
  if (!drawing) return null;
  return <svg viewBox="0 0 200 120" fill="none" stroke="currentColor" strokeWidth="1.2" aria-hidden="true" focusable="false">{drawing}</svg>;
};
