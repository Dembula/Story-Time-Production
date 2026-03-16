"use client";

import { useModocOptional } from "./use-modoc";

/**
 * Renders its children only when MODOC is available (inside ModocProvider).
 * Use to show an "Ask MODOC" button or panel trigger in any dashboard.
 * Children can use useModoc() to access append, messages, setScope, etc.
 */
export function ModocChatTrigger({
  children,
}: {
  children: React.ReactNode;
}) {
  const modoc = useModocOptional();
  if (!modoc) return null;
  return <>{children}</>;
}
