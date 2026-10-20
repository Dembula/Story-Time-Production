import "server-only";

import { prisma } from "@/lib/prisma";
import { CONTENT_REVIEW_FESTIVAL_HOLD } from "@/lib/festival/constants";

/** Create a catalogue Content row held until the festival ends (Universe opt-in). */
export async function createUniverseHoldContent(args: {
  creatorUserId: string;
  festivalId: string;
  submissionId: string;
  title: string;
  description?: string | null;
  screenerUrl?: string | null;
  trailerUrl?: string | null;
  stillUrl?: string | null;
}) {
  return prisma.content.create({
    data: {
      title: args.title,
      description: args.description ?? null,
      type: "FILM",
      videoUrl: args.screenerUrl ?? null,
      trailerUrl: args.trailerUrl ?? null,
      posterUrl: args.stillUrl ?? null,
      published: false,
      reviewStatus: CONTENT_REVIEW_FESTIVAL_HOLD,
      creatorId: args.creatorUserId,
      festivalHoldFestivalId: args.festivalId,
      festivalSubmissionId: args.submissionId,
      submittedAt: new Date(),
    },
  });
}

/** When a festival is marked ENDED, release held Universe opt-ins into admin PENDING. */
export async function releaseUniverseHoldsForFestival(festivalId: string) {
  return prisma.content.updateMany({
    where: {
      festivalHoldFestivalId: festivalId,
      reviewStatus: CONTENT_REVIEW_FESTIVAL_HOLD,
    },
    data: {
      reviewStatus: "PENDING",
      festivalHoldFestivalId: null,
      submittedAt: new Date(),
    },
  });
}

export function isFestivalHoldBlockingApproval(content: {
  reviewStatus?: string | null;
  festivalHoldFestivalId?: string | null;
}): boolean {
  if (content.reviewStatus === CONTENT_REVIEW_FESTIVAL_HOLD) return true;
  return Boolean(content.festivalHoldFestivalId);
}
