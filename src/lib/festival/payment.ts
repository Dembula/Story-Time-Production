import "server-only";

import { prisma } from "@/lib/prisma";
import { FESTIVAL_SUBMISSION_FEE_PURPOSE } from "@/lib/festival/constants";

export async function festivalSubmissionHasSuccessfulPayment(submissionId: string): Promise<boolean> {
  const paid = await prisma.paymentRecord.findFirst({
    where: {
      relatedEntityType: "FestivalSubmission",
      relatedEntityId: submissionId,
      purpose: FESTIVAL_SUBMISSION_FEE_PURPOSE,
      status: "SUCCEEDED",
    },
    select: { id: true },
  });
  return Boolean(paid);
}
