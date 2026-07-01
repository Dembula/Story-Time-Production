export type PersonPreview = {
  personId: string;
  displayName: string;
  imageUrl: string | null;
  roles: string[];
  bio: string | null;
  blurb: string | null;
  productionCount: number;
  followerCount: number | null;
  followingCount: number | null;
  verified: boolean;
  profileHref: string;
  latestProject: { id: string; title: string; type: string; posterUrl: string | null } | null;
  topGenres: string[];
  isCreator: boolean;
  creatorUserId: string | null;
  credits: Array<{
    contentId: string;
    title: string;
    type: string;
    role: string;
    posterUrl: string | null;
    year: number | null;
  }>;
};

export function normalizeCreditName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function groupContentCredits<
  T extends { id: string; name: string; role: string; creditPersonId: string | null },
>(members: T[]): Array<{
  key: string;
  personId: string | null;
  name: string;
  roles: string[];
  crewMemberIds: string[];
}> {
  const map = new Map<
    string,
    { personId: string | null; name: string; roles: string[]; crewMemberIds: string[] }
  >();

  for (const m of members) {
    const key = m.creditPersonId ?? `name:${normalizeCreditName(m.name)}`;
    const existing = map.get(key);
    if (existing) {
      if (!existing.roles.includes(m.role)) existing.roles.push(m.role);
      existing.crewMemberIds.push(m.id);
    } else {
      map.set(key, {
        personId: m.creditPersonId,
        name: m.name,
        roles: [m.role],
        crewMemberIds: [m.id],
      });
    }
  }

  return [...map.entries()].map(([key, v]) => ({ key, ...v }));
}
