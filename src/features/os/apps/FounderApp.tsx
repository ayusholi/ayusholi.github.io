"use client";

import { useOs } from "../OsContext";
import { productById } from "../os-engine";
import type { Product } from "../os-types";
import { Badge } from "./parts";

export function FounderApp() {
  const { state, select } = useOs();
  const sel = state.selection.founder;
  const apostro = productById("apostro")!, alls = productById("allslegal")!, clippr = productById("theclippr")!;
  const pick = (id: string) => select("founder", id);

  return (
    <div className="app founder">
      <header className="founder__head">
        <p className="app__kicker">Independent products</p>
        <h3 className="founder__title">Things I&apos;m building, end to end.</h3>
      </header>

      <section className="journey" aria-label="Product journey: ALLS Legal to Apostro">
        <button type="button" className="journey__node" aria-pressed={sel === alls.id} onClick={() => pick(alls.id)}>
          <span className="journey__v">v0</span><strong>{alls.name}</strong><small>{alls.description}</small>
        </button>
        <div className="journey__link" aria-hidden="true">
          <svg viewBox="0 0 120 20" preserveAspectRatio="none"><path d="M0,10 H112" /><path d="M106,4 L114,10 L106,16" /></svg>
          <span>evolved into</span>
        </div>
        <button type="button" className="journey__node journey__node--now" aria-pressed={sel === apostro.id} onClick={() => pick(apostro.id)}>
          <span className="journey__v">now</span><strong>{apostro.name}</strong><small>{apostro.description}</small>
        </button>
      </section>

      <div className="founder__grid">
        <ProductCard p={apostro} selected={sel === apostro.id} onPick={pick} tenants={["Firm A", "Firm B", "Firm C"]} />
        <div className="founder__side">
          <ProductCard p={clippr} selected={sel === clippr.id} onPick={pick} tenants={["shop-a.site", "shop-b.site", "shop-c.site"]} />
          <ProductCard p={alls} selected={sel === alls.id} onPick={pick} />
        </div>
      </div>
    </div>
  );
}

function ProductCard({ p, selected, onPick, tenants }: { p: Product; selected: boolean; onPick: (id: string) => void; tenants?: string[] }) {
  return (
    <article className="product" data-flagship={p.flagship || undefined} data-selected={selected || undefined} aria-labelledby={`prod-${p.id}`}>
      <header className="product__head">
        <Badge tone={p.flagship ? "lime" : "dim"}>{p.status}</Badge>
        <h4 className="product__name" id={`prod-${p.id}`}>
          <button type="button" onClick={() => onPick(p.id)} aria-pressed={selected}>{p.name}</button>
        </h4>
        <p className="product__tag">{p.tagline}</p>
      </header>
      <p className="product__desc">{p.description}</p>
      {p.flagship ? (
        <ol className="modules">
          {p.features.map((f, i) => <li key={f}><span>{String(i + 1).padStart(2, "0")}</span>{f}</li>)}
        </ol>
      ) : (
        <ul className="chips chips--static">{p.features.map((f) => <li key={f} className="chip chip--static">{f}</li>)}</ul>
      )}
      {tenants && p.architecture && <Tenancy label={p.architecture[0] ?? ""} root={p.name} tenants={tenants} />}
      {p.url && <a className="xref" href={p.url} target="_blank" rel="noopener">{p.url.replace(/^https?:\/\//, "")} <span aria-hidden="true">↗</span></a>}
    </article>
  );
}

// One platform serving isolated tenants. Tenant names are illustrative.
function Tenancy({ label, root, tenants }: { label: string; root: string; tenants: string[] }) {
  return (
    <figure className="tenancy">
      <figcaption className="block__label">{label} <span>· tenants illustrative</span></figcaption>
      <svg viewBox="0 0 300 92" role="img" aria-label={`${root} serves each tenant separately: ${tenants.join(", ")}`}>
        <rect x="100" y="4" width="100" height="26" className="dg__box dg__box--hi" />
        <text x="150" y="21" textAnchor="middle" className="dg__text dg__text--sm">{root}</text>
        {tenants.map((t, i) => {
          const x = 8 + i * 98;
          return (
            <g key={t}>
              <path d={`M150,30 C150,46 ${x + 43},44 ${x + 43},60`} className="dg__wire dg__wire--flow" />
              <rect x={x} y="60" width="86" height="26" className="dg__box" />
              <text x={x + 43} y="77" textAnchor="middle" className="dg__text dg__text--sm">{t}</text>
            </g>
          );
        })}
      </svg>
    </figure>
  );
}
