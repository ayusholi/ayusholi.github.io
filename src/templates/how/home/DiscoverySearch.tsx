"use client";

import { useEffect, useRef, type ReactNode } from "react";

// Filters the server-rendered plates and collections in place, so the whole
// catalogue doesn't need to become client code for one search box.
export const DiscoverySearch = ({ children }: { children: ReactNode }) => {
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = root.current;
    const input = el?.querySelector<HTMLInputElement>("#find");
    const none = el?.querySelector<HTMLElement>("#find-none");
    if (!el || !input || !none) return;
    const onInput = () => {
      const q = input.value.trim().toLowerCase();
      let shown = 0;
      el.querySelectorAll<HTMLElement>("[data-find]").forEach((item) => {
        const match = !q || (item.dataset.find as string).includes(q);
        if (item.classList.contains("plate")) item.classList.toggle("is-hidden", !match);
        else { item.hidden = !match; (item as HTMLDetailsElement).open = !!q && match; }
        if (match) shown++;
      });
      none.hidden = shown > 0;
      none.textContent = shown ? "" : `Nothing on “${input.value}” yet.`;
    };
    input.addEventListener("input", onInput);
    return () => input.removeEventListener("input", onInput);
  }, []);
  return <div ref={root}>{children}</div>;
};
