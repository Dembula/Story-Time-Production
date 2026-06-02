import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAgencyForUser, parseTalentProfile, requireCastingAgencySession } from "@/lib/casting-agency";
import { handleCastingAgencyApiError } from "@/lib/casting-agency-errors";
import { MARKETPLACE_TRANSACTION_TYPE, sumPayeeCompletedAmount } from "@/lib/financial-ledger";

export async function GET() {
  try {
  const auth = await requireCastingAgencySession();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const agency = await getAgencyForUser(auth.session.userId);
  if (!agency) return NextResponse.json({ error: "Create agency profile first" }, { status: 404 });

  const [
    talentRows,
    pendingInquiries,
    pendingInvitations,
    openAuditions,
    activeSubmissions,
    signedContracts,
    revenue,
  ] = await Promise.all([
    prisma.castingTalent.findMany({
      where: { castingAgencyId: agency.id },
      select: { bio: true, agencyCommissionPercent: true, representationType: true },
    }),
    prisma.castingInquiry.count({ where: { agencyId: agency.id, status: "PENDING" } }),
    prisma.castingInvitation.count({
      where: { castingAgencyId: agency.id, status: "PENDING" },
    }),
    prisma.auditionPost.count({ where: { status: "OPEN" } }),
    prisma.castingAuditionSubmission.count({
      where: {
        castingAgencyId: agency.id,
        status: { in: ["SUBMITTED", "SHORTLISTED", "CALLBACK"] },
      },
    }),
    prisma.projectContract.count({
      where: {
        castingTalent: { castingAgencyId: agency.id },
        status: { in: ["SIGNED", "ACTIVE"] },
      },
    }),
    sumPayeeCompletedAmount(auth.session.userId, MARKETPLACE_TRANSACTION_TYPE.CAST_INQUIRY),
  ]);

  let availableTalent = 0;
  let bookedTalent = 0;
  for (const row of talentRows) {
    const profile = parseTalentProfile(row);
    const status = profile.availabilityStatus;
    if (status === "BOOKED" || status === "UNAVAILABLE") bookedTalent += 1;
    else availableTalent += 1;
  }

  return NextResponse.json({
    agency: {
      id: agency.id,
      agencyName: agency.agencyName,
      counts: agency._count,
    },
    metrics: {
      talentTotal: agency._count.talent,
      availableTalent,
      bookedTalent,
      pendingInquiries,
      pendingInvitations,
      openAuditions,
      activeSubmissions,
      signedContracts,
      revenue,
    },
  });
  } catch (error) {
    const { message, status } = handleCastingAgencyApiError(error, "Unable to load dashboard overview.");
    return NextResponse.json({ error: message }, { status });
  }
}
