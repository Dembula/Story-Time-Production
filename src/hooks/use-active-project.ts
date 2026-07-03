"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ACTIVE_PROJECT_STORAGE_KEY,
  getActiveProjectId,
  resolveDefaultProjectId,
  setActiveProjectId,
  sortProjectsWithActiveFirst,
  type ProjectListItem,
} from "@/lib/active-project";

/** Live active project id from localStorage + cross-tab/custom events. */
export function useActiveProjectId(): string | null {
  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    setActiveId(getActiveProjectId());
    const onStorage = (event: StorageEvent) => {
      if (event.key && event.key !== ACTIVE_PROJECT_STORAGE_KEY) return;
      setActiveId(getActiveProjectId());
    };
    const onCustom = (event: Event) => {
      const detail = (event as CustomEvent<{ projectId?: string }>).detail;
      setActiveId(detail?.projectId ?? getActiveProjectId());
    };
    window.addEventListener("storage", onStorage);
    window.addEventListener("storytime:active-project", onCustom);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("storytime:active-project", onCustom);
    };
  }, []);

  const setActive = useCallback((projectId: string | null | undefined) => {
    setActiveProjectId(projectId);
    setActiveId(projectId?.trim() || null);
  }, []);

  return activeId;
}

export function useOrderedCreatorProjects<T extends ProjectListItem>(projects: T[]): T[] {
  const activeId = useActiveProjectId();
  return sortProjectsWithActiveFirst(projects, activeId);
}

export function useDefaultCreatorProjectId<T extends ProjectListItem>(projects: T[]): string | null {
  const activeId = useActiveProjectId();
  return resolveDefaultProjectId(projects, activeId);
}
