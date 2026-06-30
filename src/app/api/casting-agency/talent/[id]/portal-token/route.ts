import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { issueTalentPortalToken, talentPortalUrl } from "@/lib/stakeholder-ecosystem/talent-portal-service";

export async function POST(_req: Request, context: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string })?.id;
  const role = (session?.user as { role?: string })?.role;
  if (!userId || role !== "CASTING_AGENCY") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await context.params;
  const agency = await prisma.castingAgency.findFirst({ where: { userId }, select: { id: true } });
  if (!agency) return NextResponse.json({ error: "Agency not found" }, { status: 404 });

  const talent = await prisma.castingTalent.findFirst({
    where: { id, castingAgencyId: agency.id },
    select: { id: true, name: true },
  });
  if (!talent) return NextResponse.json({ error: "Talent not found" }, { status: 404 });

  const token = await issueTalentPortalToken(talent.id);
  return NextResponse.json({
    url: talentPortalUrl(token.token),
    expiresAt: token.expiresAt.toISOString(),
    talentName: talent.name,
  });
}
