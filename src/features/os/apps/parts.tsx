"use client";

import type { ReactNode } from "react";
import { useOs } from "../OsContext";
import type { Tech } from "../os-types";

// List on the left, detail on the right. Below 720px only one shows at a time.
export function Panes({ list, detail, showDetail, onBack, backLabel = "All" }: {
  list: ReactNode; detail: ReactNode; showDetail: boolean; onBack: () => void; backLabel?: string;
}) {
  return (
    <div className="panes" data-detail={showDetail || undefined}>
      <div className="panes__list">{list}</div>
      <div className="panes__detail" key={String(showDetail)}>
        {showDetail && <button type="button" className="panes__back" onClick={onBack}>← {backLabel}</button>}
        {detail}
      </div>
    </div>
  );
}

/** A technology that opens itself in STACK.MAP. */
export function TechChips({ techs, label = "Stack" }: { techs: Tech[]; label?: string }) {
  const { open } = useOs();
  const unique = [...new Map(techs.map((t) => [t.id, t])).values()];
  if (!unique.length) return null;
  return (
    <div className="block">
      <h4 className="block__label">{label}</h4>
      <ul className="chips">
        {unique.map((t) => (
          <li key={t.id}><button type="button" className="chip" onClick={() => open("stack", t.id)} title={`Trace ${t.name} in STACK.MAP`}>{t.name}</button></li>
        ))}
      </ul>
    </div>
  );
}

export function Block({ label, items, children }: { label: string; items?: string[]; children?: ReactNode }) {
  if (!children && !items?.length) return null;
  return (
    <div className="block">
      <h4 className="block__label">{label}</h4>
      {items && <ul className="ticks">{items.map((x) => <li key={x}>{x}</li>)}</ul>}
      {children}
    </div>
  );
}

export const Badge = ({ children, tone }: { children: ReactNode; tone?: "lime" | "dim" | "warn" }) => (
  <span className="badge" data-tone={tone}>{children}</span>
);
