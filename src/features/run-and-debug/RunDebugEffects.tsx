"use client";

import { useEffect } from "react";
import { initRunDebug } from "./run-debug-effects";

// Starts the page's behaviour once. The guard covers Strict Mode's double effect.
let started = false;

export const RunDebugEffects = () => {
  useEffect(() => {
    if (started) return;
    started = true;
    initRunDebug();
  }, []);
  return null;
};
