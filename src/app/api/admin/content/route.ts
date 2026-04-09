import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const role = (session?.user as { role?: string })?.role;
  if (role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const status = req.nextUrl.searchParams.get("status");
  const where: Record<string, unknown> = {};
  if (status && status !== "ALL") {
    where.reviewStatus = status;
  }

  const content = await prisma.content.findMany({
    where,
    include: {
      creator: { select: { id: true, name: true, email: true, isAfdaStudent: true } },
      linkedProject: { select: { id: true, title: true } },
      _count: { select: { watchSessions: true, ratings: true, comments: true, crewMembers: true } },
      crewMembers: { select: { name: true, role: true }, take: 5 },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(content);
}
