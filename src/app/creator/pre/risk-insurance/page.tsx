"use client";

import { PreToolStandalone } from "@/components/project-tools/pre/PreToolStandalone";
import { findToolBySlug } from "@/lib/project-tools";

const meta = findToolBySlug("risk-insurance")!;

export default function PreRiskInsurancePage() {
  return (
    <PreToolStandalone
      toolSlug={meta.toolSlug}
      title={meta.label}
      description={meta.description}
    />
  );
}

