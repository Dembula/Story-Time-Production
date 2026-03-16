"use client";

import { PreToolStandalone } from "@/components/project-tools/pre/PreToolStandalone";
import { findToolBySlug } from "@/lib/project-tools";

const meta = findToolBySlug("legal-contracts")!;

export default function PreLegalContractsPage() {
  return (
    <PreToolStandalone
      toolSlug={meta.toolSlug}
      title={meta.label}
      description={meta.description}
    />
  );
}

