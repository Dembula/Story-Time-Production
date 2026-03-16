"use client";

import { Suspense } from "react";
import { PreToolStandalone } from "@/components/project-tools/pre/PreToolStandalone";
import { findToolBySlug } from "@/lib/project-tools";

const meta = findToolBySlug("crew-marketplace")!;

export default function PreCrewMarketplacePage() {
  return (
    <Suspense fallback={<div className="space-y-4 p-4 text-slate-400">Loading…</div>}>
      <PreToolStandalone
        toolSlug={meta.toolSlug}
        title={meta.label}
        description={meta.description}
      />
    </Suspense>
  );
}

