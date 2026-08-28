import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { notifyCastingInquiryCreated } from "@/lib/marketplace-notifications";
import { buildMarketplaceBookingNote } from "@/lib/marketplace-booking-context";

/** Creator: casting inquiries sent to agencies (for status + pay). */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const role = (session.user as { role?: string })?.role;
  if (role !== "CONTENT_CREATOR" && role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const userId = (session.user as { id?: string })?.id!;
  const rows = await prisma.castingInquiry.findMany({
    where: { creatorId: userId },
    orderBy: { createdAt: "desc" },
    include: {
      agency: { select: { id: true, agencyName: true, userId: true } },
    },
  });
  return NextResponse.json(rows);
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const role = (session.user as { role?: string })?.role;
  if (role !== "CONTENT_CREATOR" && role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const userId = (session.user as { id?: string })?.id;
  const body = await req.json();
  const agencyId = body.agencyId;
  if (!agencyId) return NextResponse.json({ error: "agencyId required" }, { status: 400 });
  const agency = await prisma.castingAgency.findUnique({
    where: { id: agencyId },
    select: { id: true, agencyName: true, userId: true },
  });
  if (!agency) return NextResponse.json({ error: "Agency not found" }, { status: 404 });
  const creator = await prisma.user.findUnique({ where: { id: userId! }, select: { name: true } });

  let projectTitle = typeof body.projectName === "string" ? body.projectName : null;
  const projectId = typeof body.projectId === "string" ? body.projectId : null;
  if (projectId) {
    const project = await prisma.originalProject.findFirst({
      where: { id: projectId, pitches: { some: { creatorId: userId! } } },
      select: { id: true, title: true },
    });
    if (project) projectTitle = project.title;
  }

  const inquiry = await prisma.castingInquiry.create({
    data: {
      creatorId: userId!,
      agencyId,
      talentId: body.talentId ?? null,
      projectName: projectTitle,
      roleName: body.roleName ?? null,
      message: buildMarketplaceBookingNote(body.message ?? null, {
        projectId,
        projectTitle,
      }),
      status: "PENDING",
    },
  });
  try {
    await notifyCastingInquiryCreated({
      agencyUserId: agency.userId,
      creatorName: creator?.name,
      agencyName: agency.agencyName,
      inquiryId: inquiry.id,
    });
  } catch {
    /* non-blocking */
  }
  return NextResponse.json(inquiry);
}
