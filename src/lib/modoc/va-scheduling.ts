import "server-only";

import { prisma } from "@/lib/prisma";

/** Parse ISO or YYYY-MM-DD dates from VA action payloads. */
export function parseVaActionDate(...candidates: (string | undefined)[]): Date | null {
  for (const raw of candidates) {
    const trimmed = raw?.trim();
    if (!trimmed) continue;
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      const d = new Date(`${trimmed}T12:00:00.000Z`);
      if (!Number.isNaN(d.getTime())) return d;
    }
    const d = new Date(trimmed);
    if (!Number.isNaN(d.getTime())) return d;
  }
  return null;
}

/** Normalize to an all-day calendar start (noon UTC for date-only strings). */
export function normalizeCalendarStartAt(raw: string): Date {
  const trimmed = raw.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    const d = new Date(`${trimmed}T12:00:00.000Z`);
    if (!Number.isNaN(d.getTime())) return d;
  }
  const d = new Date(trimmed);
  if (Number.isNaN(d.getTime())) {
    throw new Error("Invalid date");
  }
  return d;
}

export async function resolveVaProjectId(
  userId: string,
  payloadProjectId?: string | null,
): Promise<string | null> {
  if (payloadProjectId?.trim()) return payloadProjectId.trim();
  const project = await prisma.originalProject.findFirst({
    where: {
      OR: [{ pitches: { some: { creatorId: userId } } }, { members: { some: { userId } } }],
    },
    orderBy: { updatedAt: "desc" },
    select: { id: true },
  });
  return project?.id ?? null;
}
