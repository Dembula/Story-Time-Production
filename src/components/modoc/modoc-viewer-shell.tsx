"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { ModocViewerPanel } from "./modoc-viewer-panel";
import { useModocOptional } from "./use-modoc";
import { canShowViewerModoc } from "@/lib/modoc/viewer-va";

/** Viewer MODOC panel on /browse — opened via the Ask MODOC button (no floating FAB). */
export function ModocViewerShell() {
  const pathname = usePathname();
  const { data: session, status: sessionStatus } = useSession();
  const role = (session?.user as { role?: string } | undefined)?.role;
  const modoc = useModocOptional();
  const [open, setOpen] = useState(false);
  const [available, setAvailable] = useState(false);

  useEffect(() => {
    fetch("/api/modoc/status")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setAvailable(Boolean(d?.available)))
      .catch(() => setAvailable(false));
  }, []);

  useEffect(() => {
    const openHandler = () => setOpen(true);
    window.addEventListener("modoc:open-viewer", openHandler);
    return () => window.removeEventListener("modoc:open-viewer", openHandler);
  }, []);

  if (!modoc || !available) return null;

  if (!canShowViewerModoc({ sessionStatus, role, pathname })) {
    return null;
  }

  return (
    <ModocViewerPanel
      open={open}
      onClose={() => setOpen(false)}
    />
  );
}
