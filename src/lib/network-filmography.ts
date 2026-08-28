import { prisma } from "@/lib/prisma";

export type NetworkFilmographyItem = {
  contentId: string;
  title: string;
  type: string;
  posterUrl: string | null;
  year: number | null;
  role: string;
};

function mergeFilmographyItem(
  map: Map<string, NetworkFilmographyItem>,
  item: NetworkFilmographyItem,
) {
  const existing = map.get(item.contentId);
  if (!existing) {
    map.set(item.contentId, item);
    return;
  }
  if (existing.role === "Creator" && item.role !== "Creator") return;
  if (item.role === "Creator") {
    map.set(item.contentId, item);
    return;
  }
  if (!existing.role.includes(item.role)) {
    existing.role = `${existing.role} · ${item.role}`;
  }
}

export async function getUserFilmography(
  userId: string,
  limit = 12,
): Promise<NetworkFilmographyItem[]> {
  const [owned, creditPerson] = await Promise.all([
    prisma.content.findMany({
      where: { creatorId: userId, published: true },
      select: { id: true, title: true, type: true, posterUrl: true, year: true, createdAt: true },
      orderBy: { createdAt: "desc" },
      take: limit,
    }),
    prisma.creditPerson.findUnique({
      where: { userId },
      select: {
        crewMembers: {
          where: { content: { published: true } },
          select: {
            role: true,
            content: {
              select: {
                id: true,
                title: true,
                type: true,
                posterUrl: true,
                year: true,
                createdAt: true,
              },
            },
          },
          orderBy: { createdAt: "desc" },
          take: limit * 2,
        },
      },
    }),
  ]);

  const byContentId = new Map<string, NetworkFilmographyItem>();

  for (const content of owned) {
    mergeFilmographyItem(byContentId, {
      contentId: content.id,
      title: content.title,
      type: content.type,
      posterUrl: content.posterUrl,
      year: content.year,
      role: "Creator",
    });
  }

  for (const crewMember of creditPerson?.crewMembers ?? []) {
    const content = crewMember.content;
    mergeFilmographyItem(byContentId, {
      contentId: content.id,
      title: content.title,
      type: content.type,
      posterUrl: content.posterUrl,
      year: content.year,
      role: crewMember.role,
    });
  }

  return [...byContentId.values()].slice(0, limit);
}

export async function getFilmographyForUsers(
  userIds: string[],
  perUser = 3,
): Promise<Map<string, NetworkFilmographyItem[]>> {
  const result = new Map<string, NetworkFilmographyItem[]>();
  if (userIds.length === 0) return result;

  const [ownedContents, creditPersons] = await Promise.all([
    prisma.content.findMany({
      where: { creatorId: { in: userIds }, published: true },
      select: {
        id: true,
        title: true,
        type: true,
        posterUrl: true,
        year: true,
        creatorId: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.creditPerson.findMany({
      where: { userId: { in: userIds } },
      select: {
        userId: true,
        crewMembers: {
          where: { content: { published: true } },
          select: {
            role: true,
            content: {
              select: {
                id: true,
                title: true,
                type: true,
                posterUrl: true,
                year: true,
                createdAt: true,
              },
            },
          },
          orderBy: { createdAt: "desc" },
        },
      },
    }),
  ]);

  function addForUser(userId: string, item: NetworkFilmographyItem) {
    const perUserMap = new Map(
      (result.get(userId) ?? []).map((entry) => [entry.contentId, entry] as const),
    );
    mergeFilmographyItem(perUserMap, item);
    result.set(userId, [...perUserMap.values()]);
  }

  for (const content of ownedContents) {
    if (!content.creatorId) continue;
    addForUser(content.creatorId, {
      contentId: content.id,
      title: content.title,
      type: content.type,
      posterUrl: content.posterUrl,
      year: content.year,
      role: "Creator",
    });
  }

  for (const person of creditPersons) {
    if (!person.userId) continue;
    for (const crewMember of person.crewMembers) {
      const content = crewMember.content;
      addForUser(person.userId, {
        contentId: content.id,
        title: content.title,
        type: content.type,
        posterUrl: content.posterUrl,
        year: content.year,
        role: crewMember.role,
      });
    }
  }

  for (const [userId, items] of result) {
    result.set(userId, items.slice(0, perUser));
  }

  return result;
}
