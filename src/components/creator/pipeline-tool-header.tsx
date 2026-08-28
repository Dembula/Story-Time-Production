"use client";

import type { ReactNode } from "react";

type PipelineToolHeaderProps = {
  eyebrow?: string;
  title: string;
  description?: ReactNode;
  links?: ReactNode;
  toolbar?: ReactNode;
  children?: ReactNode;
};

export function PipelineToolHeader({
  eyebrow = "Pre-production workspace",
  title,
  description,
  links,
  toolbar,
  children,
}: PipelineToolHeaderProps) {
  return (
    <header className="creator-tool-workspace-header">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1">
          <p className="creator-tool-workspace-eyebrow">{eyebrow}</p>
          <h1 className="creator-tool-workspace-title">{title}</h1>
          {description ? (
            <div className="creator-tool-workspace-description">{description}</div>
          ) : null}
          {links ? <div className="mt-3 flex flex-wrap gap-3 text-xs">{links}</div> : null}
        </div>
        {toolbar ? (
          <div className="flex shrink-0 flex-wrap items-center gap-2 lg:justify-end">{toolbar}</div>
        ) : null}
      </div>
      {children ? <div className="mt-4 border-t border-white/8 pt-4">{children}</div> : null}
    </header>
  );
}

export function PipelineToolShell({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={`creator-tool-workspace ${className}`.trim()}>{children}</div>;
}

export function PipelineToolBody({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`creator-tool-workspace-body ${className}`.trim()}>{children}</div>;
}
