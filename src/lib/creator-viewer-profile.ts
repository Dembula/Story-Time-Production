import { displayCreatorGoals } from "@/lib/creator-profile-goals";

const AFDA_EDUCATION_FALLBACKS = new Set([
  "afda",
  "afda film school",
  "afda johannesburg",
  "afda cape town",
  "afda durban",
  "afda film school johannesburg",
  "afda film school cape town",
]);

export function isAfdaEducationFallback(education: string | null | undefined): boolean {
  const trimmed = education?.trim();
  if (!trimmed) return false;
  return AFDA_EDUCATION_FALLBACKS.has(trimmed.toLowerCase());
}

export function sanitizeCreatorEducation(
  education: string | null | undefined,
  institutionName?: string | null,
): string | null {
  const trimmed = education?.trim();
  if (!trimmed) return null;
  if (isAfdaEducationFallback(trimmed)) return null;
  const inst = institutionName?.trim().toLowerCase();
  if (inst && trimmed.toLowerCase() === inst) return null;
  return trimmed;
}

export type CreatorAboutSource = {
  bio?: string | null;
  education?: string | null;
  goals?: string | null;
  previousWork?: string | null;
  socialLinks?: string | null;
  institutionName?: string | null;
  showCreatorAboutOnTitles?: boolean | null;
};

export function getCreatorAboutDisplayFields(creator: CreatorAboutSource) {
  const bio = creator.bio?.trim() || null;
  const education = sanitizeCreatorEducation(creator.education, creator.institutionName);
  const goals = displayCreatorGoals(creator.goals)?.trim() || null;
  const previousWork = creator.previousWork?.trim() || null;

  let socialLinks: Record<string, string> = {};
  if (creator.socialLinks?.trim()) {
    try {
      const parsed = JSON.parse(creator.socialLinks) as Record<string, string>;
      if (parsed && typeof parsed === "object") socialLinks = parsed;
    } catch {
      creator.socialLinks
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
        .forEach((entry, i) => {
          socialLinks[`Link ${i + 1}`] = entry;
        });
    }
  }

  return { bio, education, goals, previousWork, socialLinks };
}

export function hasCreatorAboutContent(creator: CreatorAboutSource): boolean {
  const fields = getCreatorAboutDisplayFields(creator);
  return Boolean(
    fields.bio ||
      fields.education ||
      fields.goals ||
      fields.previousWork ||
      Object.keys(fields.socialLinks).length > 0,
  );
}

export function shouldShowCreatorAboutSection(creator: CreatorAboutSource): boolean {
  if (!creator.showCreatorAboutOnTitles) return false;
  return hasCreatorAboutContent(creator);
}

export function shouldEnableCreatorAboutOnSignup(input: {
  bio?: string | null;
  education?: string | null;
  goals?: string | null;
  previousWork?: string | null;
  institutionName?: string | null;
}): boolean {
  return hasCreatorAboutContent({
    bio: input.bio,
    education: sanitizeCreatorEducation(input.education, input.institutionName),
    goals: input.goals,
    previousWork: input.previousWork,
  });
}
