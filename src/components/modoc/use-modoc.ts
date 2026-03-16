"use client";

import { useContext } from "react";
import { ModocContext } from "./modoc-context";

/**
 * Hook to access MODOC (Machine Orchestrating Digital Operations for Creation)
 * from any component. Use in client components only.
 *
 * - messages, sendMessage, status, error: chat state and actions
 * - setScope / setClientContext / setPageContext: tell MODOC where the user is
 * - setRequestContext: set scope + clientContext + pageContext in one call
 */
export function useModoc() {
  const ctx = useContext(ModocContext);
  if (!ctx) {
    throw new Error("useModoc must be used within a ModocProvider");
  }
  return ctx;
}

/**
 * Optional hook that returns null if ModocProvider is not mounted.
 * Use when MODOC is optional (e.g. in a layout that may or may not wrap the provider).
 */
export function useModocOptional() {
  return useContext(ModocContext);
}
