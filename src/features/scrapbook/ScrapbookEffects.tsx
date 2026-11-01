"use client";

import { useEffect } from "react";
import { initScrapbook } from "./scrapbook-effects";

// Starts the page's behaviour once. The guard covers Strict Mode's double effect.
let started = false;

export const ScrapbookEffects = () => {
  useEffect(() => {
    if (started) return;
    started = true;
    initScrapbook();
  }, []);
  return null;
};
