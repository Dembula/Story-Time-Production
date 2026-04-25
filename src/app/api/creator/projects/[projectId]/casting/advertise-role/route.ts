import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const LISTING_FEE = 99.99;

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
  return { error: null as NextResponse | null, userId, email: session.user?.email ?? null };
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

  const payment = await prisma.paymentRecord.create({
    data: {
      userId: creatorId,
      provider: "DISABLED",
      purpose: "AUDITION_LISTING",
      status: "SUCCEEDED",
      amount: LISTING_FEE,
      currency: "ZAR",
      email: access.email,
      paidAt: new Date(),
      metadata: {
        kind: "AUDITION_LISTING",
        roleId: role.id,
        projectId,
        scheduledAt: body.scheduledAt ?? null,
        details: body.details ?? null,
      } as any,
    },
  });

  const msgParts = [
    `Audition listing for role "${role.name}".`,
    body.scheduledAt ? `Scheduled: ${body.scheduledAt}` : null,
    body.details ? `Details: ${body.details}` : null,
    `Listing fee paid: R${LISTING_FEE.toFixed(2)}.`,
  ].filter(Boolean);

  const created = await prisma.$transaction(
    agencies.map((agency) =>
      prisma.castingInvitation.create({
        data: {
          projectId,
          roleId: role.id,
          creatorId,
          castingAgencyId: agency.id,
          message: msgParts.join(" "),
          status: "PENDING",
        },
      }),
    ),
  );

  return NextResponse.json({
    ok: true,
    listingFee: LISTING_FEE,
    paymentId: payment.id,
    invitationsCreated: created.length,
  });
}
