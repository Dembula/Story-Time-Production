import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const role = (session?.user as { role?: string })?.role;
  if (role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const { contentId, action, reviewNote, featured } = body;

  if (!contentId || !action) {
    return NextResponse.json({ error: "contentId and action required" }, { status: 400 });
  }

  const now = new Date();

  if (action === "APPROVE") {
    const updated = await prisma.content.update({
      where: { id: contentId },
      data: {
        reviewStatus: "APPROVED",
        published: true,
        featured: featured ?? false,
        reviewNote: reviewNote || null,
        reviewedAt: now,
      },
    });
    return NextResponse.json(updated);
  }

  if (action === "REJECT") {
    const updated = await prisma.content.update({
      where: { id: contentId },
      data: {
        reviewStatus: "REJECTED",
        published: false,
        reviewNote: reviewNote || "Content did not meet platform guidelines.",
        reviewedAt: now,
      },
    });
    return NextResponse.json(updated);
  }

  if (action === "REQUEST_CHANGES") {
    const updated = await prisma.content.update({
      where: { id: contentId },
      data: {
        reviewStatus: "CHANGES_REQUESTED",
        published: false,
        reviewNote: reviewNote || "Please address the noted issues and resubmit.",
        reviewedAt: now,
      },
    });
    return NextResponse.json(updated);
  }

  if (action === "UNPUBLISH") {
    const updated = await prisma.content.update({
      where: { id: contentId },
      data: {
        reviewStatus: "UNPUBLISHED",
        published: false,
        reviewNote: reviewNote || null,
        reviewedAt: now,
      },
    });
    return NextResponse.json(updated);
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}
