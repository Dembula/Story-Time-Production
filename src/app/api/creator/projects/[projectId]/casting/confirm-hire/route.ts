import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseEmbeddedMeta, type ActorMarketMeta } from "@/lib/marketplace-profile-meta";
import { initializeCheckout } from "@/lib/payments/billing";
import { buildPaymentReturnUrl } from "@/lib/payments/return-url";
import { CASTING_ACQUISITION_FEE_ZAR } from "@/lib/pricing";

async function ensureCreatorForProject(projectId: string) {
  const session = await getServerSession(authOptions);
  const role = (session?.user as { role?: string })?.role;
  const userId = (session?.user as { id?: string })?.id;
  if (!session || !userId || (role !== "CONTENT_CREATOR" && role !== "ADMIN")) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }), userId: null as string | null };
  }
  const project = await prisma.originalProject.findUnique({
    where: { id: projectId },
    include: { members: true, pitches: true },
  });
  if (!project) return { error: NextResponse.json({ error: "Not found" }, { status: 404 }), userId: null as string | null };
  const isCreatorMember =
    role === "ADMIN" ||
    project.members.some((m) => m.userId === userId) ||
    project.pitches.some((p) => p.creatorId === userId);
  if (!isCreatorMember) return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }), userId: null as string | null };
  return {
    error: null as NextResponse | null,
    userId,
    email: session.user?.email ?? null,
    name: session.user?.name ?? null,
  };
}

export async function POST(req: NextRequest, context: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await context.params;
  const access = await ensureCreatorForProject(projectId);
  if (access.error) return access.error;
  const userId = access.userId!;

  const body = (await req.json().catch(() => null)) as
    | { invitationId?: string; salaryAmount?: number | null; salaryNotes?: string | null }
    | null;
  if (!body?.invitationId) {
    return NextResponse.json({ error: "Missing invitationId" }, { status: 400 });
  }

  const invitation = await prisma.castingInvitation.findFirst({
    where: { id: body.invitationId, projectId },
    include: { role: true, castingAgency: true, talent: true, project: true },
  });
  if (!invitation) return NextResponse.json({ error: "Invitation not found" }, { status: 404 });
  if (invitation.status !== "ACCEPTED") {
    return NextResponse.json({ error: "Invitation must be accepted first" }, { status: 400 });
  }
  if (!invitation.talent) {
    return NextResponse.json({ error: "Accepted invitation has no talent linked" }, { status: 400 });
  }

  const existingContract = await prisma.projectContract.findFirst({
    where: { projectId, type: "ACTOR", castingTalentId: invitation.talent.id },
    select: { id: true },
  });
  if (existingContract) {
    return NextResponse.json({ error: "Contract already exists for this talent." }, { status: 409 });
  }

  const talent = invitation.talent;
  const parsedTalentMeta = parseEmbeddedMeta<ActorMarketMeta>(talent.bio);
  const fallbackRate = Number(parsedTalentMeta.meta?.dailyRate ?? 0);
  const salaryAmount = Math.max(0, Number(body.salaryAmount ?? fallbackRate));

  try {
    const { checkout, paymentRecord } = await initializeCheckout({
      userId,
      email: access.email,
      customerName: access.name,
      amount: CASTING_ACQUISITION_FEE_ZAR,
      purpose: "CASTING_ACQUISITION_FEE",
      referenceType: "CastingInvitation",
      referenceId: invitation.id,
      returnUrl: buildPaymentReturnUrl(
        `/creator/projects/${projectId}/pre-production/casting`,
        "casting_acquisition",
      ),
      metadata: {
        kind: "CASTING_ACQUISITION_FEE",
        invitationId: invitation.id,
        roleId: invitation.roleId,
        talentId: invitation.talentId,
        castingAgencyId: invitation.castingAgencyId,
        projectId,
        salaryAmount,
        salaryNotes: body.salaryNotes ?? null,
      },
    });

    return NextResponse.json({
      ok: true,
      requiresPayment: true,
      acquisitionFee: CASTING_ACQUISITION_FEE_ZAR,
      paymentId: paymentRecord.id,
      checkoutUrl: checkout.checkoutUrl,
      paymentRecordId: paymentRecord.id,
      salaryAmount,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to initialize checkout.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
