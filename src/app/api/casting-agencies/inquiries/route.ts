import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const role = (session.user as { role?: string })?.role;
  if (role !== "CONTENT_CREATOR" && role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const userId = (session.user as { id?: string })?.id;
  const body = await req.json();
  const agencyId = body.agencyId;
  if (!agencyId) return NextResponse.json({ error: "agencyId required" }, { status: 400 });
  const agency = await prisma.castingAgency.findUnique({ where: { id: agencyId } });
  if (!agency) return NextResponse.json({ error: "Agency not found" }, { status: 404 });
  const inquiry = await prisma.castingInquiry.create({
    data: {
      creatorId: userId!,
      agencyId,
      talentId: body.talentId ?? null,
      projectName: body.projectName ?? null,
      roleName: body.roleName ?? null,
      message: body.message ?? null,
      status: "PENDING",
    },
  });
  return NextResponse.json(inquiry);
}
