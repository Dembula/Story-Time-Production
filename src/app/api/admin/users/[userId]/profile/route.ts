import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(_req: Request, { params }: { params: Promise<{ userId: string }> }) {
  const session = await getServerSession(authOptions);
  const role = (session?.user as { role?: string })?.role;
  if (role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { userId } = await params;
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      createdAt: true,
      adminRights: true,
      originalPitches: {
        orderBy: { updatedAt: "desc" },
        take: 20,
        select: {
          id: true,
          title: true,
          status: true,
          projectId: true,
          scriptProjectId: true,
          createdAt: true,
          updatedAt: true,
        },
      },
      originalMembers: {
        include: {
          project: {
            select: {
              id: true,
              title: true,
              status: true,
              phase: true,
              pitches: { select: { status: true }, orderBy: { createdAt: "desc" }, take: 1 },
            },
          },
        },
      },
      contents: {
        orderBy: { createdAt: "desc" },
        take: 10,
        select: { id: true, title: true, type: true, reviewStatus: true, createdAt: true },
      },
      _count: { select: { activityLogs: true, contents: true, watchSessions: true } },
    },
  });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const activity = await prisma.activityLog.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 200,
    select: {
      id: true,
      eventType: true,
      referrer: true,
      ipAddress: true,
      deviceType: true,
      userAgent: true,
      createdAt: true,
    },
  });

  return NextResponse.json({ user, activity });
}
