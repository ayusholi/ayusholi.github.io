"use client";

import { AnimatePresence, m } from "motion/react";
import type { ReactNode } from "react";

// Explains the selected part of a diagram. Falls back to `idle` when given.
type Props = { item: { name: string; role: string } | null; className?: string; idle?: ReactNode };

export const ComponentInspector = ({ item, className = "", idle }: Props) => (
  <AnimatePresence mode="wait" initial={false}>
    {item ? (
      <m.div key={item.name} className={`inspector ${className}`} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
        <p className="label">Inspecting</p>
        <h3>{item.name}</h3>
        <p>{item.role}</p>
      </m.div>
    ) : idle ? <div className={`inspector ${className}`}>{idle}</div> : null}
  </AnimatePresence>
);
