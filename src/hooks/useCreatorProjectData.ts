"use client";

import { useQuery } from "@tanstack/react-query";

/** Shared react-query keys and fetchers for creator project tools (schedule, breakdown, project script). */

export function useProjectSchedule(projectId: string | undefined) {
  return useQuery({
    queryKey: ["project-schedule", projectId],
    queryFn: () => fetch(`/api/creator/projects/${projectId}/schedule`).then((r) => r.json()),
    enabled: !!projectId,
  });
}

export function useProjectBreakdown(projectId: string | undefined) {
  return useQuery({
    queryKey: ["project-breakdown", projectId],
    queryFn: () => fetch(`/api/creator/projects/${projectId}/breakdown`).then((r) => r.json()),
    enabled: !!projectId,
  });
}

export function useProjectScript(projectId: string | undefined) {
  return useQuery({
    queryKey: ["project-script", projectId],
    queryFn: () => fetch(`/api/creator/projects/${projectId}/script`).then((r) => r.json()),
    enabled: !!projectId,
  });
}

export function useProjectScenesList(projectId: string | undefined) {
  return useQuery({
    queryKey: ["project-scenes", projectId],
    queryFn: () => fetch(`/api/creator/projects/${projectId}/scenes`).then((r) => r.json()),
    enabled: !!projectId,
  });
}

export function useProjectCallSheets(projectId: string | undefined) {
  return useQuery({
    queryKey: ["project-call-sheets", projectId],
    queryFn: () => fetch(`/api/creator/projects/${projectId}/call-sheets`).then((r) => r.json()),
    enabled: !!projectId,
  });
}
