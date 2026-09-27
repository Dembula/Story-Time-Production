import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getActiveEditReviewGuest } from "@/lib/edit-review/guest-session";
import { resolveEditPlayback } from "@/lib/edit-review/playback";
import { getStorageObjectSignedUrl } from "@/lib/storage-object-fetch";
import { resolveStorageObjectRef } from "@/lib/storage-object-ref";
import { isPlatformStorageReference } from "@/lib/secure-file-access";
import { isReadyStreamStatus } from "@/lib/content-approve-publish";

export const dynamic = "force-dynamic";

export async function GET() {
  const guest = await getActiveEditReviewGuest();
  if (!guest) {
    return NextResponse.json({ error: "Guest session required" }, { status: 401 });
  }

  const review = await prisma.postProductionReview.findFirst({
    where: { id: guest.reviewId, projectId: guest.projectId },
    include: {
      cutAsset: true,
      notes: {
        orderBy: { createdAt: "asc" },
        include: {
          user: { select: { id: true, name: true, image: true } },
        },
      },
    },
  });
  if (!review) {
    return NextResponse.json({ error: "Review not found" }, { status: 404 });
  }

  // Enrich Stream metadata when present
  if (review.cutAsset) {
    try {
      const stream = await prisma.streamAsset.findFirst({
        where: {
          entityType: "FootageAsset",
          entityId: review.cutAsset.id,
        },
        orderBy: { updatedAt: "desc" },
        select: { hlsUrl: true, playbackUrl: true, status: true, uid: true },
      });
      if (stream && isReadyStreamStatus(stream.status) && (stream.hlsUrl || stream.playbackUrl)) {
        let meta: Record<string, unknown> = {};
        if (review.cutAsset.metadata?.trim()) {
          try {
            meta = JSON.parse(review.cutAsset.metadata) as Record<string, unknown>;
          } catch {
            meta = {};
          }
        }
        if (!meta.hlsUrl && !meta.playbackUrl) {
          review.cutAsset.metadata = JSON.stringify({
            ...meta,
            hlsUrl: stream.hlsUrl ?? undefined,
            playbackUrl: stream.playbackUrl ?? stream.hlsUrl ?? undefined,
            streamUid: stream.uid,
            streamStatus: stream.status,
          });
        }
      }
    } catch {
      /* ignore stream enrich failures */
    }
  }

  let playback: { src: string; type: string } | null = null;
  const resolved = resolveEditPlayback(review.cutAsset, guest.projectId);
  if (resolved) {
    let src = resolved.src;
    if (
      resolved.kind === "preview" &&
      review.cutAsset?.fileUrl &&
      isPlatformStorageReference(review.cutAsset.fileUrl)
    ) {
      try {
        const ref = resolveStorageObjectRef(review.cutAsset.fileUrl);
        if (ref) {
          const signed = await getStorageObjectSignedUrl(ref, { expiresIn: 60 * 60 });
          if (signed) src = signed;
        }
      } catch {
        /* keep proxy path */
      }
    }
    playback = {
      src,
      type: resolved.kind === "hls" ? "application/vnd.apple.mpegurl" : "video/mp4",
    };
  }

  return NextResponse.json({
    guest: {
      name: guest.guestName,
      email: guest.guestEmail,
      inviterName: guest.inviterName,
      expiresAt: guest.expiresAt?.toISOString() ?? null,
    },
    review: {
      id: review.id,
      title: review.title,
      status: review.status,
      cutAsset: review.cutAsset
        ? {
            id: review.cutAsset.id,
            label: review.cutAsset.label,
            fileUrl: review.cutAsset.fileUrl,
            type: review.cutAsset.type,
            createdAt: review.cutAsset.createdAt.toISOString(),
            metadata: review.cutAsset.metadata,
          }
        : null,
      notes: review.notes.map((n) => ({
        id: n.id,
        reviewId: n.reviewId,
        userId: n.userId,
        body: n.body,
        timestampMs: n.timestampMs,
        createdAt: n.createdAt.toISOString(),
        guestName: n.guestName,
        guestEmail: n.guestEmail,
        user: n.user,
      })),
    },
    playback,
  });
}
