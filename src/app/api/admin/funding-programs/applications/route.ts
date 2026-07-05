import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { syncApprovedProgramApplicationToFundingHub } from "@/lib/funding-application-source-sync";

function requireAdmin(session: { user?: { role?: string; id?: string } } | null) {
  const role = session?.user?.role;
  if (role !== "ADMIN") return null;
  return session?.user?.id ?? null;
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const adminId = requireAdmin(session);
  if (!adminId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const programId = req.nextUrl.searchParams.get("programId");
  const applications = await prisma.fundingProgramApplication.findMany({
    where: {
      program: { managedBy: "ADMIN" },
      ...(programId ? { programId } : {}),
    },
    include: {
      program: { select: { id: true, title: true } },
      project: { select: { id: true, title: true, genre: true } },
      creatorUser: { select: { id: true, name: true, professionalName: true, email: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  return NextResponse.json({
    applications: applications.map((a) => ({
      id: a.id,
      programId: a.programId,
      programTitle: a.program.title,
      projectId: a.projectId,
      projectTitle: a.project.title,
      projectGenre: a.project.genre,
      creatorName: a.creatorUser.professionalName || a.creatorUser.name,
      creatorEmail: a.creatorUser.email,
      requestedAmount: a.requestedAmount,
      notes: a.notes,
      documentFlags: a.documentFlags,
      status: a.status,
      adminNote: a.adminNote,
      submittedAt: a.createdAt.toISOString(),
    })),
  });
}

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const adminId = requireAdmin(session);
  if (!adminId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = (await req.json().catch(() => null)) as {
    id?: string;
    status?: string;
    adminNote?: string | null;
  } | null;
  if (!body?.id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const existing = await prisma.fundingProgramApplication.findFirst({
    where: { id: body.id, program: { managedBy: "ADMIN" } },
  });
  if (!existing) return NextResponse.json({ error: "Application not found" }, { status: 404 });

  const application = await prisma.fundingProgramApplication.update({
    where: { id: existing.id },
    data: {
      ...(body.status ? { status: body.status } : {}),
      ...(body.adminNote !== undefined ? { adminNote: body.adminNote?.trim() || null } : {}),
    },
  });

  if (body.status === "APPROVED") {
    await syncApprovedProgramApplicationToFundingHub(application.id).catch(() => {});
  }

  return NextResponse.json({ application });
}
