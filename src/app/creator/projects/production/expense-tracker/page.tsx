"use client";

import { ProductionToolStandalone } from "@/components/project-tools/production/ProductionToolStandalone";
import { findToolBySlug } from "@/lib/project-tools";

const meta = findToolBySlug("expense-tracker")!;

export default function ProjectsProductionExpenseTrackerPage() {
  return (
    <ProductionToolStandalone
      toolSlug={meta.toolSlug}
      title={meta.label}
      description={meta.description}
    />
  );
}

