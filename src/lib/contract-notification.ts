import { notifyUser } from "@/lib/notify-user";

export function contractNotificationLink(contractId: string, projectId: string): string {
  return `/creator/legal/inbox/${contractId}?projectId=${encodeURIComponent(projectId)}`;
}

export function contractProjectLink(projectId: string, contractId?: string): string {
  const base = `/creator/projects/${projectId}/pre-production/legal-contracts`;
  return contractId ? `${base}?contractId=${encodeURIComponent(contractId)}` : base;
}
