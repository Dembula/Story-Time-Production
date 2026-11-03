"use client";

import { ProductionToolStandalone } from "@/components/project-tools/production/ProductionToolStandalone";
import { findToolBySlug } from "@/lib/project-tools";

const meta = findToolBySlug("cont-sheet")!;

export default function ProductionContSheetPage() {
  return (
    <ProductionToolStandalone
      toolSlug={meta.toolSlug}
      title={meta.label}
      description={meta.description}
    />
  );
}
