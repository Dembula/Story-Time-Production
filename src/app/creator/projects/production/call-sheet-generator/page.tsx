"use client";

import { ProductionToolStandalone } from "@/components/project-tools/production/ProductionToolStandalone";
import { findToolBySlug } from "@/lib/project-tools";

const meta = findToolBySlug("call-sheet-generator")!;

export default function ProjectsProductionCallSheetGeneratorPage() {
  return (
    <ProductionToolStandalone
      toolSlug={meta.toolSlug}
      title={meta.label}
      description={meta.description}
    />
  );
}

