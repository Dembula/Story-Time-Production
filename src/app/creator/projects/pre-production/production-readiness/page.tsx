"use client";

import { PreToolStandalone } from "@/components/project-tools/pre/PreToolStandalone";
import { findToolBySlug } from "@/lib/project-tools";

const meta = findToolBySlug("production-readiness")!;

export default function ProjectsPreProductionReadinessPage() {
  return (
    <PreToolStandalone
      toolSlug={meta.toolSlug}
      title={meta.label}
      description={meta.description}
    />
  );
}

