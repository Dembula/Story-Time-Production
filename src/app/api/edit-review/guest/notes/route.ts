import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getActiveEditReviewGuest } from "@/lib/edit-review/guest-session";

export async function POST(req: NextRequest) {
  const guest = await getActiveEditReviewGuest();
  if (!guest) {
    return NextResponse.json({ error: "Guest session required" }, { status: 401 });
  }

  const body = (await req.json().catch(() => null)) as
    | { body?: string; timestampMs?: number }
    | null;

  const text = body?.body?.trim() || "";
  if (!text) {
    return NextResponse.json({ error: "Comment cannot be empty" }, { status: 400 });
  }

  const review = await prisma.postProductionReview.findFirst({
    where: { id: guest.reviewId, projectId: guest.projectId },
    select: { id: true },
  });
  if (!review) {
    return NextResponse.json({ error: "Review not found" }, { status: 404 });
  }

  const note = await prisma.reviewNote.create({
    data: {
      reviewId: review.id,
      userId: null,
      guestName: guest.guestName,
      guestEmail: guest.guestEmail,
      body: text,
      timestampMs:
        typeof body?.timestampMs === "number" && Number.isFinite(body.timestampMs)
          ? Math.max(0, Math.round(body.timestampMs))
          : null,
    },
  });

  return NextResponse.json(
    {
      note: {
        id: note.id,
        reviewId: note.reviewId,
        userId: null,
        body: note.body,
        timestampMs: note.timestampMs,
        createdAt: note.createdAt.toISOString(),
        guestName: note.guestName,
        guestEmail: note.guestEmail,
        user: null,
      },
    },
    { status: 201 },
  );
}
