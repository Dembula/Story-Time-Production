import { createHash } from "crypto";
import { generateText } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { prisma } from "@/lib/prisma";

const openRouter = createOpenAI({
  apiKey: process.env.OPENROUTER_API_KEY ?? "",
  baseURL: "https://openrouter.ai/api/v1",
});

type BlurbCredit = {
  contentId: string;
  title: string;
  role: string;
  year: number | null;
  type: string;
};

export function computeCreditsHash(
  credits: BlurbCredit[],
  displayName: string,
  roles: string[],
): string {
  const payload = {
    displayName,
    roles: [...roles].sort(),
    credits: [...credits]
      .sort((a, b) => a.contentId.localeCompare(b.contentId))
      .map((c) => ({ id: c.contentId, role: c.role, title: c.title, year: c.year })),
  };
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex").slice(0, 24);
}

export function buildTemplateCreditBlurb(input: {
  displayName: string;
  roles: string[];
  productionCount: number;
  credits: BlurbCredit[];
  topGenres: string[];
}): string {
  const { displayName, roles, productionCount, credits, topGenres } = input;
  const roleLabel =
    roles.length > 0
      ? roles.slice(0, 3).join(", ")
      : credits[0]?.role ?? "film and television";
  const latestTitles = credits.slice(0, 3).map((c) => c.title);
  const genreNote =
    topGenres.length > 0 ? ` Their work spans ${topGenres.slice(0, 2).join(" and ")}.` : "";

  if (latestTitles.length === 0) {
    return `${displayName} is credited as ${roleLabel} on Story Time.`;
  }

  const titlePhrase =
    latestTitles.length === 1
      ? latestTitles[0]
      : `${latestTitles.slice(0, -1).join(", ")} and ${latestTitles.at(-1)}`;

  const countNote =
    productionCount > latestTitles.length
      ? ` across ${productionCount} production${productionCount === 1 ? "" : "s"} on Story Time`
      : " on Story Time";

  return `${displayName} is credited as ${roleLabel}${countNote}, including ${titlePhrase}.${genreNote}`.replace(
    /\.\./g,
    ".",
  );
}

async function generateAiCreditBlurb(input: {
  displayName: string;
  roles: string[];
  credits: BlurbCredit[];
  topGenres: string[];
  bio: string | null;
}): Promise<string | null> {
  if (!process.env.OPENROUTER_API_KEY) return null;

  const creditLines = input.credits
    .slice(0, 8)
    .map((c) => `- ${c.role} on "${c.title}"${c.year ? ` (${c.year})` : ""}`)
    .join("\n");

  try {
    const { text } = await generateText({
      model: openRouter.chat("openai/gpt-4o-mini"),
      maxOutputTokens: 120,
      temperature: 0.35,
      messages: [
        {
          role: "system",
          content:
            "Write a concise third-person biography blurb (2-3 sentences, max 320 characters) for a film/TV credits card. Use only the supplied credits and roles. Do not invent awards, schools, or projects not listed. Plain text only.",
        },
        {
          role: "user",
          content: `Name: ${input.displayName}
Roles: ${input.roles.join(", ") || "Various"}
Genres: ${input.topGenres.join(", ") || "n/a"}
Existing bio: ${input.bio ?? "none"}
Credits:
${creditLines || "none"}`,
        },
      ],
    });
    const trimmed = text.trim();
    return trimmed.length > 0 ? trimmed.slice(0, 420) : null;
  } catch {
    return null;
  }
}

export async function ensureCreditPersonBlurb(personId: string): Promise<string | null> {
  const person = await prisma.creditPerson.findUnique({
    where: { id: personId },
    include: {
      user: { select: { bio: true, headline: true } },
      crewMembers: {
        include: {
          content: {
            select: {
              id: true,
              title: true,
              type: true,
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
  const credits: BlurbCredit[] = publishedCredits.map((c) => ({
    contentId: c.content.id,
    title: c.content.title,
    role: c.role,
    year: c.content.year,
    type: c.content.type,
  }));

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

  const hash = computeCreditsHash(credits, person.displayName, roles);
  if (person.generatedBlurb && person.blurbCreditsHash === hash) {
    return person.generatedBlurb;
  }

  const bio = person.user?.bio ?? person.user?.headline ?? person.bio ?? null;
  const template = buildTemplateCreditBlurb({
    displayName: person.displayName,
    roles,
    productionCount: credits.length,
    credits,
    topGenres,
  });

  const aiBlurb = await generateAiCreditBlurb({
    displayName: person.displayName,
    roles,
    credits,
    topGenres,
    bio,
  });

  const blurb = aiBlurb ?? template;

  await prisma.creditPerson.update({
    where: { id: personId },
    data: {
      generatedBlurb: blurb,
      blurbCreditsHash: hash,
      blurbUpdatedAt: new Date(),
    },
  });

  return blurb;
}

export async function refreshCreditPersonBlurbsForContent(contentId: string) {
  const members = await prisma.crewMember.findMany({
    where: { contentId, creditPersonId: { not: null } },
    select: { creditPersonId: true },
  });
  const ids = [...new Set(members.map((m) => m.creditPersonId).filter(Boolean))] as string[];
  for (const id of ids) {
    try {
      await ensureCreditPersonBlurb(id);
    } catch {
      // Non-blocking refresh
    }
  }
}
