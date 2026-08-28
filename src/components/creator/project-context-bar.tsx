"use client";

import { Clapperboard } from "lucide-react";

export type ProjectSwitcherOption = { id: string; title: string };

type ProjectContextBarProps = {
  projectId: string;
  switchableProjects: ProjectSwitcherOption[];
  isOriginal?: boolean;
  adminNote?: string | null;
  onSwitchProject: (nextProjectId: string) => void;
  onClearProject: () => void;
  embedded?: boolean;
};

export function ProjectContextBar({
  projectId,
  switchableProjects,
  isOriginal,
  adminNote,
  onSwitchProject,
  onClearProject,
  embedded = false,
}: ProjectContextBarProps) {
  const handleChange = (value: string) => {
    if (!value) {
      onClearProject();
      return;
    }
    if (value === projectId) return;
    onSwitchProject(value);
  };

  return (
    <header
      className={
        embedded
          ? "creator-workspace-rail creator-workspace-rail--embedded"
          : "creator-workspace-rail"
      }
    >
      <div className="creator-workspace-rail-inner">
        <div className="creator-workspace-rail-project">
          <Clapperboard className="h-4 w-4 shrink-0 text-orange-300/85" aria-hidden />
          <span className="creator-workspace-rail-label">Project</span>
          <select
            id="project-context-switcher"
            value={projectId}
            onChange={(e) => handleChange(e.target.value)}
            aria-label="Active project"
            className="storytime-select storytime-select--embedded creator-workspace-project-select"
          >
            <option value="">No project selected</option>
            {switchableProjects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title}
              </option>
            ))}
          </select>
          {isOriginal ? (
            <span className="creator-workspace-rail-badge">Original</span>
          ) : null}
        </div>
        {adminNote ? (
          <p className="creator-workspace-rail-note" title={adminNote}>
            <span className="text-orange-300/90">Note:</span> {adminNote}
          </p>
        ) : null}
      </div>
    </header>
  );
}

export function ProjectContextBarStandalone({
  projectId,
  projects,
  isLoading,
  onChange,
}: {
  projectId: string;
  projects: ProjectSwitcherOption[];
  isLoading?: boolean;
  onChange: (projectId: string) => void;
}) {
  return (
    <header className="creator-workspace-rail creator-workspace-rail--embedded">
      <div className="creator-workspace-rail-inner">
        <div className="creator-workspace-rail-project">
          <Clapperboard className="h-4 w-4 shrink-0 text-orange-300/85" aria-hidden />
          <span className="creator-workspace-rail-label">Project</span>
          <label htmlFor="project-context-standalone" className="sr-only">
            Active project
          </label>
          {isLoading ? (
            <div className="h-9 w-56 max-w-full animate-pulse rounded-lg bg-white/[0.06]" />
          ) : (
            <select
              id="project-context-standalone"
              value={projectId}
              onChange={(e) => onChange(e.target.value)}
              className="storytime-select storytime-select--embedded creator-workspace-project-select"
            >
              <option value="">No project selected</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>
    </header>
  );
}