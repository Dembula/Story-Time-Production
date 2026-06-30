import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { resolveTalentPortalToken } from "@/lib/stakeholder-ecosystem/talent-portal-service";

export async function GET(_req: NextRequest, context: { params: Promise<{ token: string }> }) {
  const { token } = await context.params;
  const row = await resolveTalentPortalToken(token);
  if (!row) return NextResponse.json({ error: "Invalid or expired link" }, { status: 404 });

  const t = row.talent;
  return NextResponse.json({
    talent: {
      id: t.id,
      name: t.name,
      headshotUrl: t.headshotUrl,
      agencyName: t.castingAgency.agencyName,
      representationType: t.representationType,
    },
    availability: t.availabilityBlocks,
    contracts: t.projectContracts.map((c) => ({
      id: c.id,
      status: c.status,
      type: c.type,
      projectTitle: c.project.title,
    })),
    invitations: t.castingInvitations.map((i) => ({
      id: i.id,
      status: i.status,
      projectTitle: i.project.title,
      roleName: i.role.name,
    })),
    expiresAt: row.expiresAt.toISOString(),
  });
}
