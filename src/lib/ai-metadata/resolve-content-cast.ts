import "server-only";

import { prisma } from "@/lib/prisma";

/** Cast / character names to ground script-based scene intelligence. */
export async function resolveContentCastNames(contentId: string): Promise<string[]> {
  const content = await prisma.content.findUnique({
    where: { id: contentId },
    select: {
      linkedProjectId: true,
      crewMembers: { select: { name: true, role: true } },
    },
  });
  if (!content) return [];

  const names = new Set<string>();

  if (content.linkedProjectId) {
    const characters = await prisma.breakdownCharacter.findMany({
      where: { projectId: content.linkedProjectId },
      select: { name: true },
      orderBy: { name: "asc" },
      take: 120,
    });
    for (const row of characters) {
      const name = row.name?.trim();
      if (name) names.add(name);
    }
  }

  for (const crew of content.crewMembers) {
    const name = crew.name?.trim();
    if (!name) continue;
    const role = crew.role?.toLowerCase() ?? "";
    if (/actor|cast|talent|performer|voice|lead|supporting/.test(role)) {
      names.add(name);
    }
  }

  return [...names];
}
