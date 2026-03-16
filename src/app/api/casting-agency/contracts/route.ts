import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const role = (session.user as { role?: string })?.role;
  if (role !== "CASTING_AGENCY" && role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const userId = (session.user as { id?: string })?.id;

  const agency = await prisma.castingAgency.findUnique({ where: { userId: userId! } });
  if (!agency) return NextResponse.json([]);

  const contracts = await prisma.projectContract.findMany({
    where: { castingTalent: { castingAgencyId: agency.id } },
    orderBy: { createdAt: "desc" },
    include: {
      project: { select: { id: true, title: true } },
      versions: { orderBy: { version: "desc" }, take: 1, select: { id: true, version: true, createdAt: true } },
      castingTalent: { select: { id: true, name: true } },
    },
  });

  return NextResponse.json(
    contracts.map((c) => ({
      id: c.id,
      type: c.type,
      status: c.status,
      subject: c.subject,
      createdAt: c.createdAt,
      project: c.project,
      talent: c.castingTalent,
      version: c.versions[0] ?? null,
    }))
  );
}

