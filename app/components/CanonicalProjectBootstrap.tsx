"use client";

import { useEffect } from "react";
import { reconcileCanonicalProject } from "../lib/canonical-project";

/** Reconciles browser-chat/ for every application entry route. */
export function CanonicalProjectBootstrap() {
  useEffect(() => {
    void reconcileCanonicalProject().catch((error) => {
      console.error("Canonical project reconciliation failed", error);
    });
  }, []);
  return null;
}
