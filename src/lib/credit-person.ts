import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma";
import { getFollowerCount, getFollowingCount } from "@/lib/network-db";
import { normalizeCreditName, type PersonPreview } from "@/lib/credit-person-types";
import { ensureCreditPersonBlurb } from "@/lib/credit-person-blurb";

const CREATOR_ROLES = ["CONTENT_CREATOR", "MUSIC_CREATOR", "ADMIN"] as const;

export async function tryMatchCreatorUserByName(normalizedName: string) {
  if (!normalizedName) return null;
  const users = await prisma.user.findMany({
    where: {
      role: { in: [...CREATOR_ROLES] },
      OR: [{ name: { not: null } }, { professionalName: { not: null } }],
    },
    select: { id: true, name: true, professionalName: true, image: true, bio: true, role: true },
    take: 500,
  });

  for (const user of users) {
    const candidates = [user.name, user.professionalName].filter(Boolean) as string[];
    if (candidates.some((c) => normalizeCreditName(c) === normalizedName)) {
      return user;
    }
  }
  return null;
}

export async function resolveOrCreateCreditPerson(input: {
  name: string;
  bio?: string | null;
  imageUrl?: string | null;
  userId?: string | null;
}) {
  const displayName = input.name.trim();
  const normalizedName = normalizeCreditName(displayName);
  if (!normalizedName) {
    throw new Error("Invalid credit name");
  }

  let person = await prisma.creditPerson.findUnique({ where: { normalizedName } });

  if (input.userId) {
    const linked = await prisma.creditPerson.findUnique({ where: { userId: input.userId } });
    if (linked && person && linked.id !== person.id) {
      person = linked;
    } else if (linked) {
      person = linked;
    }
  }

  if (!person) {
    const matchedUser =
      input.userId != null
        ? await prisma.user.findUnique({
            where: { id: input.userId },
            select: { id: true, name: true, professionalName: true, image: true, bio: true },
          })
        : await tryMatchCreatorUserByName(normalizedName);

    person = await prisma.creditPerson.create({
      data: {
        displayName,
        normalizedName,
        bio: input.bio ?? matchedUser?.bio ?? null,
        imageUrl: input.imageUrl ?? matchedUser?.image ?? null,
        userId: input.userId ?? matchedUser?.id ?? null,
      },
    });
    return person;
  }

  const updates: {
    displayName?: string;
    bio?: string | null;
    imageUrl?: string | null;
    userId?: string | null;
  } = {};

  if (displayName && person.displayName !== displayName) updates.displayName = displayName;
  if (input.bio && !person.bio) updates.bio = input.bio;
  if (input.imageUrl && !person.imageUrl) updates.imageUrl = input.imageUrl;
  if (input.userId && !person.userId) updates.userId = input.userId;
  if (!person.userId && !input.userId) {
    const matched = await tryMatchCreatorUserByName(normalizedName);
    if (matched) {
      updates.userId = matched.id;
      if (!person.imageUrl && matched.image) updates.imageUrl = matched.image;
      if (!person.bio && matched.bio) updates.bio = matched.bio;
    }
  }

  if (Object.keys(updates).length > 0) {
    person = await prisma.creditPerson.update({ where: { id: person.id }, data: updates });
  }

  return person;
}

export async function ensureCrewMemberCreditPerson(crewMemberId: string) {
  const member = await prisma.crewMember.findUnique({
    where: { id: crewMemberId },
    select: { id: true, name: true, bio: true, creditPersonId: true },
  });
  if (!member) return null;
  if (member.creditPersonId) {
    return prisma.creditPerson.findUnique({ where: { id: member.creditPersonId } });
  }
  const person = await resolveOrCreateCreditPerson({ name: member.name, bio: member.bio });
  await prisma.crewMember.update({
    where: { id: member.id },
    data: { creditPersonId: person.id },
  });
  return person;
}

export async function buildPersonPreview(personId: string): Promise<PersonPreview | null> {
  const person = await prisma.creditPerson.findUnique({
    where: { id: personId },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          professionalName: true,
          image: true,
          bio: true,
          headline: true,
          primaryRole: true,
          role: true,
        },
      },
      crewMembers: {
        include: {
          content: {
            select: {
              id: true,
              title: true,
              type: true,
              posterUrl: true,
              year: true,
              category: true,
              published: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!person) return null;

  const publishedCredits = person.crewMembers.filter((c) => c.content.published);
  const roles = [...new Set(publishedCredits.map((c) => c.role))];
  const genreCounts = new Map<string, number>();
  for (const c of publishedCredits) {
    const g = c.content.category?.trim();
    if (!g) continue;
    genreCounts.set(g, (genreCounts.get(g) ?? 0) + 1);
  }
  const topGenres = [...genreCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([g]) => g);

  const credits = publishedCredits.slice(0, 8).map((c) => ({
    contentId: c.content.id,
    title: c.content.title,
    type: c.content.type,
    role: c.role,
    posterUrl: c.content.posterUrl,
    year: c.content.year,
  }));

  const latest = credits[0]
    ? {
        id: credits[0].contentId,
        title: credits[0].title,
        type: credits[0].type,
        posterUrl: credits[0].posterUrl,
      }
    : null;
  const creatorUserId = person.userId;
  const isCreator = Boolean(creatorUserId);

  let followerCount: number | null = null;
  let followingCount: number | null = null;
  let creatorContents: PersonPreview["latestProject"] = latest;

  if (creatorUserId) {
    [followerCount, followingCount] = await Promise.all([
      getFollowerCount(creatorUserId),
      getFollowingCount(creatorUserId),
    ]);
    const newest = await prisma.content.findFirst({
      where: { creatorId: creatorUserId, published: true },
      orderBy: { createdAt: "desc" },
      select: { id: true, title: true, type: true, posterUrl: true },
    });
    if (newest) creatorContents = newest;
  }

  const displayName =
    person.user?.professionalName?.trim() ||
    person.user?.name?.trim() ||
    person.displayName;

  const imageUrl = person.user?.image ?? person.imageUrl;
  const bio = person.user?.bio ?? person.bio;
  const productionCount = isCreator
    ? await prisma.content.count({ where: { creatorId: creatorUserId!, published: true } })
    : publishedCredits.length;

  const verified = isCreator && productionCount > 0;

  const blurb = (await ensureCreditPersonBlurb(person.id)) ?? bio ?? person.user?.headline ?? null;

  return {
    personId: person.id,
    displayName,
    imageUrl,
    roles: roles.length > 0 ? roles : person.user?.primaryRole ? [person.user.primaryRole] : [],
    bio: bio ?? person.user?.headline ?? null,
    blurb,
    productionCount,
    followerCount,
    followingCount,
    verified,
    profileHref: isCreator ? `/creator/profile/${creatorUserId}` : `/browse/people/${person.id}`,
    latestProject: creatorContents ?? latest,
    topGenres,
    isCreator,
    creatorUserId,
    credits,
  };
}

/** Link a creator account to existing credit profiles (by name) and merge duplicates. */
export async function linkUserToCreditProfiles(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      professionalName: true,
      image: true,
      bio: true,
      role: true,
    },
  });
  if (!user) return null;

  const isCreator =
    user.role === "CONTENT_CREATOR" || user.role === "MUSIC_CREATOR" || user.role === "ADMIN";
  if (!isCreator) return null;

  const displayName = user.professionalName?.trim() || user.name?.trim();
  if (!displayName) return null;

  const normalizedNames = [
    ...new Set(
      [user.name, user.professionalName]
        .filter((n): n is string => Boolean(n?.trim()))
        .map((n) => normalizeCreditName(n)),
    ),
  ].filter(Boolean);

  const existingByUser = await prisma.creditPerson.findUnique({ where: { userId } });
  const matches =
    normalizedNames.length > 0
      ? await prisma.creditPerson.findMany({
          where: { normalizedName: { in: normalizedNames } },
        })
      : [];

  let target = existingByUser ?? matches[0] ?? null;

  if (!target) {
    return resolveOrCreateCreditPerson({
      name: displayName,
      bio: user.bio,
      imageUrl: user.image,
      userId: user.id,
    });
  }

  if (!target.userId) {
    target = await prisma.creditPerson.update({
      where: { id: target.id },
      data: {
        userId: user.id,
        imageUrl: target.imageUrl ?? user.image,
        bio: target.bio ?? user.bio,
      },
    });
  }

  for (const other of matches) {
    if (other.id !== target.id) {
      await mergeCreditPeople(target.id, other.id);
    }
  }

  if (existingByUser && existingByUser.id !== target.id) {
    await mergeCreditPeople(existingByUser.id, target.id);
    target =
      (await prisma.creditPerson.findUnique({ where: { id: existingByUser.id } })) ?? existingByUser;
  }

  return target;
}

/** Backfill CreditPerson links for crew rows missing creditPersonId. */
export async function backfillCrewMemberCreditPeople(limit = 200) {
  const members = await prisma.crewMember.findMany({
    where: { creditPersonId: null },
    select: { id: true, name: true, bio: true },
    take: limit,
  });

  let linked = 0;
  for (const member of members) {
    const person = await resolveOrCreateCreditPerson({ name: member.name, bio: member.bio });
    await prisma.crewMember.update({
      where: { id: member.id },
      data: { creditPersonId: person.id },
    });
    linked += 1;
  }

  const remaining = await prisma.crewMember.count({ where: { creditPersonId: null } });
  return { linked, remaining };
}

export async function mergeCreditPeople(keepPersonId: string, mergePersonId: string) {
  if (keepPersonId === mergePersonId) {
    throw new Error("Cannot merge a person with itself");
  }

  const [keep, merge] = await Promise.all([
    prisma.creditPerson.findUnique({ where: { id: keepPersonId } }),
    prisma.creditPerson.findUnique({ where: { id: mergePersonId } }),
  ]);

  if (!keep || !merge) throw new Error("Person not found");

  await prisma.$transaction(async (tx) => {
    await tx.crewMember.updateMany({
      where: { creditPersonId: mergePersonId },
      data: { creditPersonId: keepPersonId },
    });

    await tx.creditPerson.update({
      where: { id: keepPersonId },
      data: {
        bio: keep.bio ?? merge.bio,
        imageUrl: keep.imageUrl ?? merge.imageUrl,
        userId: keep.userId ?? merge.userId,
        externalLinks:
          (keep.externalLinks ?? merge.externalLinks) as Prisma.InputJsonValue | undefined,
        displayName: keep.displayName || merge.displayName,
      },
    });

    await tx.creditPerson.delete({ where: { id: mergePersonId } });
  });

  return keepPersonId;
}
