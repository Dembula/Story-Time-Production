import { prisma } from "@/lib/prisma";
import { isAllowedStorageUrl } from "@/lib/storage-origin";
import {
  resolveStorageObjectRef,
  uploadKeyOwnerUserId,
  type StorageObjectRef,
} from "@/lib/storage-object-ref";

const ACTIVE_MEMBER_STATUSES = new Set(["ACTIVE", "ACCEPTED"]);

async function userHasProjectAccess(userId: string, role: string, projectId: string): Promise<boolean> {
  if (role === "ADMIN") return true;
  const project = await prisma.originalProject.findUnique({
    where: { id: projectId },
    include: { members: true, pitches: { select: { creatorId: true } } },
  });
  if (!project) return false;
  return (
    project.pitches.some((p) => p.creatorId === userId) ||
    project.members.some((m) => m.userId === userId && ACTIVE_MEMBER_STATUSES.has(m.status))
  );
}

export type SecureFileAccessContext =
  | { kind: "marketplace" }
  | { kind: "project"; projectId: string }
  | { kind: "admin" };

export function isPlatformStorageReference(value: string | null | undefined): boolean {
  if (!value?.trim()) return false;
  return value.startsWith("s3://") || isAllowedStorageUrl(value);
}

export async function assertSecureFileAccess(
  userId: string,
  role: string,
  fileRef: string,
  context?: SecureFileAccessContext,
): Promise<{ ok: true; ref: StorageObjectRef } | { ok: false; error: string; status: number }> {
  const resolved = resolveStorageObjectRef(fileRef);
  if (!resolved) {
    return { ok: false, error: "File reference is not from platform storage.", status: 400 };
  }

  if (role === "ADMIN") {
    return { ok: true, ref: resolved };
  }

  const ownerUserId = uploadKeyOwnerUserId(resolved.key);
  if (ownerUserId && ownerUserId === userId) {
    return { ok: true, ref: resolved };
  }

  if (context?.kind === "admin") {
    return { ok: false, error: "Forbidden", status: 403 };
  }

  if (context?.kind === "project" && context.projectId) {
    const allowed = await userHasProjectAccess(userId, role, context.projectId);
    if (allowed) return { ok: true, ref: resolved };
    return { ok: false, error: "Forbidden", status: 403 };
  }

  // Marketplace profile assets (CVs, headshots, equipment photos, etc.) require sign-in.
  if (context?.kind === "marketplace" || !context) {
    return { ok: true, ref: resolved };
  }

  return { ok: false, error: "Forbidden", status: 403 };
}
