"use client";

import { Suspense } from "react";
import { ProductionToolStandalone } from "@/components/project-tools/production/ProductionToolStandalone";
import { findToolBySlug } from "@/lib/project-tools";

const meta = findToolBySlug("on-set-catering")!;

export default function ProductionOnSetCateringPage() {
  return (
    <Suspense fallback={<div className="space-y-4 p-4 text-slate-400">Loading…</div>}>
      <ProductionToolStandalone
        toolSlug={meta.toolSlug}
        title={meta.label}
        description={meta.description}
      />
    </Suspense>
  );
}
