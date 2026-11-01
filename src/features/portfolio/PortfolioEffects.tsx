"use client";

import { useEffect } from "react";
import { initPortfolio } from "./portfolio-effects";
import { initPlayground } from "./playground";

// Starts the page's behaviour once. The guard covers Strict Mode's double effect.
let started = false;

export const PortfolioEffects = () => {
  useEffect(() => {
    if (started) return;
    started = true;
    initPortfolio();
    initPlayground();
  }, []);
  return null;
};
