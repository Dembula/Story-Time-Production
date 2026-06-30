"use client";

export type ProjectSwitcherOption = { id: string; title: string };

type ProjectContextBarProps = {
  projectId: string;
  switchableProjects: ProjectSwitcherOption[];
  isOriginal?: boolean;
  adminNote?: string | null;
  onSwitchProject: (nextProjectId: string) => void;
  onClearProject: () => void;
};

export function ProjectContextBar({
  projectId,
  switchableProjects,
  isOriginal,
  adminNote,
  onSwitchProject,
  onClearProject,
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
    <header className="storytime-plan-card flex flex-wrap items-center gap-3 px-4 py-2.5">
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <select
          id="project-context-switcher"
          value={projectId}
          onChange={(e) => handleChange(e.target.value)}
          aria-label="Active project"
          className="storytime-select min-w-0 max-w-full flex-1 truncate px-3 py-1.5 text-sm font-medium text-white sm:max-w-md"
        >
          <option value="">No project selected</option>
          {switchableProjects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.title}
            </option>
          ))}
        </select>
        {isOriginal && (
          <span className="hidden shrink-0 rounded-full border border-orange-500/35 bg-orange-500/10 px-2 py-0.5 text-[10px] font-medium text-orange-200 sm:inline">
            Original
          </span>
        )}
      </div>
      {adminNote ? (
        <p className="w-full truncate text-[11px] text-slate-500 sm:w-auto sm:max-w-xs" title={adminNote}>
          <span className="text-orange-300/90">Note:</span> {adminNote}
        </p>
      ) : null}
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
    <header className="storytime-plan-card flex flex-wrap items-center gap-3 px-4 py-2.5">
      <label htmlFor="project-context-standalone" className="sr-only">
        Active project
      </label>
      {isLoading ? (
        <div className="h-8 w-full max-w-md animate-pulse rounded-lg bg-white/[0.06]" />
      ) : (
        <select
          id="project-context-standalone"
          value={projectId}
          onChange={(e) => onChange(e.target.value)}
          className="storytime-select min-w-0 w-full max-w-md truncate px-3 py-1.5 text-sm font-medium text-white"
        >
          <option value="">No project selected</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.title}
            </option>
          ))}
        </select>
      )}
    </header>
  );
}