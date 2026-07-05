import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string })?.id;
  const role = (session?.user as { role?: string })?.role;
  if (!userId || role !== "MUSIC_CREATOR") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [requests, deals, contracts] = await Promise.all([
    prisma.syncRequest.findMany({
      where: { musicCreatorId: userId },
      orderBy: { createdAt: "desc" },
      take: 40,
      include: {
        track: { select: { title: true, coverUrl: true } },
        requester: { select: { name: true } },
      },
    }),
    prisma.syncDeal.findMany({
      where: { musicTrack: { creatorId: userId } },
      orderBy: { createdAt: "desc" },
      take: 20,
      include: {
        musicTrack: { select: { title: true, coverUrl: true } },
        content: { select: { title: true } },
      },
    }),
    prisma.projectContract.findMany({
      where: { counterpartyUserId: userId },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: {
        id: true,
        status: true,
        subject: true,
        createdAt: true,
        project: { select: { title: true } },
      },
    }),
  ]);

  const pipeline = [
    ...requests.map((r) => ({
      id: r.id,
      kind: "SYNC_REQUEST" as const,
      title: r.track.title,
      subtitle: [r.requester.name, r.projectName].filter(Boolean).join(" · "),
      status: r.status,
      previewImageUrl: r.track.coverUrl,
      createdAt: r.createdAt.toISOString(),
      href: "/music-creator/sync-requests",
      paid: r.status === "PAID",
    })),
    ...deals.map((d) => ({
      id: d.id,
      kind: "SYNC_DEAL" as const,
      title: d.musicTrack.title,
      subtitle: d.content.title,
      status: d.status,
      previewImageUrl: d.musicTrack.coverUrl,
      createdAt: d.createdAt.toISOString(),
      href: "/music-creator/revenue",
      paid: d.status === "PAID",
    })),
    ...contracts.map((c) => ({
      id: c.id,
      kind: "CONTRACT" as const,
      title: c.subject ?? "Music licensing agreement",
      subtitle: c.project?.title ?? "Production contract",
      status: c.status,
      previewImageUrl: null as string | null,
      createdAt: c.createdAt.toISOString(),
      href: "/music-creator/contracts",
      paid: false,
    })),
  ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return NextResponse.json({
    summary: {
      requests: requests.length,
      pendingRequests: requests.filter((r) => r.status === "PENDING").length,
      approvedRequests: requests.filter((r) => r.status === "APPROVED").length,
      paidDeals: deals.filter((d) => d.status === "PAID").length,
      contracts: contracts.length,
    },
    pipeline,
  });
}
