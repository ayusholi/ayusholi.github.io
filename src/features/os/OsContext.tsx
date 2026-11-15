"use client";

import { createContext, useContext, useSyncExternalStore } from "react";
import type { AppId, Month, OsState } from "./os-types";

export type OsApi = {
  state: OsState;
  compact: boolean;
  open: (app: AppId, select?: string) => void;
  select: (app: AppId, id: string | undefined) => void;
  close: (app: AppId) => void;
  discover: (id: string) => void;
  /** Minimises everything: back to the desktop. */
  home: () => void;
};

export const OsContext = createContext<OsApi | null>(null);

export const useOs = () => {
  const api = useContext(OsContext);
  if (!api) throw new Error("useOs outside OsShell");
  return api;
};

// ---------- External stores: read during render without effects ----------

const COMPACT_QUERY = "(max-width: 1023px)";

/** True below the desktop breakpoint, where apps open full-screen one at a time. */
export const useCompact = () =>
  useSyncExternalStore(
    (cb) => {
      const mq = matchMedia(COMPACT_QUERY);
      mq.addEventListener("change", cb);
      return () => mq.removeEventListener("change", cb);
    },
    () => matchMedia(COMPACT_QUERY).matches,
    () => false,
  );

const TICK = 15_000;

/** The current time, rounded to 15 seconds so snapshots stay stable. Null on the server. */
export const useNow = (): Date | null => {
  const t = useSyncExternalStore(
    (cb) => {
      const id = setInterval(cb, TICK);
      return () => clearInterval(id);
    },
    () => Math.floor(Date.now() / TICK) * TICK,
    () => 0,
  );
  return t ? new Date(t) : null;
};

export const toMonth = (d: Date): Month => ({ y: d.getFullYear(), m: d.getMonth() + 1 });
