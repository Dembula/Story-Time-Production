import { notifyUser } from "@/lib/notify-user";

export function contractNotificationLink(contractId: string, projectId: string): string {
  return `/creator/projects/${projectId}/pre-production/legal-contracts?tab=inbox&contractId=${encodeURIComponent(contractId)}`;
}

export function contractProjectLink(projectId: string, contractId?: string): string {
  const base = `/creator/projects/${projectId}/pre-production/legal-contracts`;
  return contractId ? `${base}?contractId=${encodeURIComponent(contractId)}` : base;
}
