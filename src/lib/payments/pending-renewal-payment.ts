import "server-only";

import { prisma } from "@/lib/prisma";

const db = prisma as any;

/** Skip a new charge while a PayFast adhoc renewal is still awaiting ITN. */
export async function hasPendingRenewalPayment(
  referenceType: string,
  referenceId: string,
): Promise<boolean> {
  const pending = await db.paymentRecord.findFirst({
    where: {
      relatedEntityType: referenceType,
      relatedEntityId: referenceId,
      status: "PENDING",
    },
    select: { id: true },
  });
  return Boolean(pending);
}
