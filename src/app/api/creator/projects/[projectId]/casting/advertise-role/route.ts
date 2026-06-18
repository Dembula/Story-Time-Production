import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { initializeCheckout } from "@/lib/payments/billing";
import { buildPaymentReturnUrl } from "@/lib/payments/return-url";
import { AUDITION_LISTING_FEE_ZAR } from "@/lib/pricing";

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
  const creatorId = access.userId!;

  const body = (await req.json().catch(() => null)) as
    | {
        roleId?: string;
        scheduledAt?: string | null;
        details?: string | null;
      }
    | null;
  if (!body?.roleId) return NextResponse.json({ error: "Missing roleId" }, { status: 400 });

  const role = await prisma.castingRole.findFirst({
    where: { id: body.roleId, projectId },
    select: { id: true, name: true },
  });
  if (!role) return NextResponse.json({ error: "Role not found" }, { status: 404 });

  const agencies = await prisma.castingAgency.findMany({ select: { id: true } });
  if (agencies.length === 0) {
    return NextResponse.json({ error: "No casting agencies available for broadcast" }, { status: 400 });
  }

  const existingListing = await prisma.castingInvitation.findFirst({
    where: {
      projectId,
      roleId: role.id,
      creatorId,
      message: { contains: "Listing fee paid" },
    },
    select: { id: true },
  });
  if (existingListing) {
    return NextResponse.json({ error: "This role has already been advertised." }, { status: 409 });
  }

  try {
    const { checkout, paymentRecord } = await initializeCheckout({
      userId: creatorId,
      email: access.email,
      customerName: access.name,
      amount: AUDITION_LISTING_FEE_ZAR,
      purpose: "AUDITION_LISTING",
      referenceType: "CastingRole",
      referenceId: role.id,
      returnUrl: buildPaymentReturnUrl(
        `/creator/projects/${projectId}/pre-production/casting`,
        "audition_listing",
      ),
      metadata: {
        kind: "AUDITION_LISTING",
        roleId: role.id,
        roleName: role.name,
        projectId,
        creatorId,
        scheduledAt: body.scheduledAt ?? null,
        details: body.details ?? null,
      },
    });

    return NextResponse.json({
      ok: true,
      requiresPayment: true,
      listingFee: AUDITION_LISTING_FEE_ZAR,
      paymentId: paymentRecord.id,
      checkoutUrl: checkout.checkoutUrl,
      paymentRecordId: paymentRecord.id,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to initialize checkout.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
