"use client";

import { ProductionToolStandalone } from "@/components/project-tools/production/ProductionToolStandalone";
import { findToolBySlug } from "@/lib/project-tools";

const meta = findToolBySlug("on-set-tasks")!;

export default function ProductionOnSetTasksPage() {
  return (
    <ProductionToolStandalone
      toolSlug={meta.toolSlug}
      title={meta.label}
      description={meta.description}
    />
  );
}

