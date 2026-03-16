"use client";

import { PreToolStandalone } from "@/components/project-tools/pre/PreToolStandalone";
import { findToolBySlug } from "@/lib/project-tools";

const meta = findToolBySlug("script-review")!;

export default function ProjectsPreScriptReviewPage() {
  return (
    <PreToolStandalone
      toolSlug={meta.toolSlug}
      title={meta.label}
      description={meta.description}
    />
  );
}

