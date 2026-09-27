import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getActiveScriptReviewGuest } from "@/lib/script-review/guest-session";
import {
  annotationInclude,
  resolveScriptReviewDraftContent,
} from "@/lib/script-review/guest-draft";
import type { ReviewAnnotationRecord } from "@/lib/script-review/types";

export const dynamic = "force-dynamic";

type AnnotationSource = {
  id: string;
  type: string;
  layer: string;
  pageIndex: number;
  lineIndex: number | null;
  anchorText: string | null;
  body: string | null;
  data: unknown;
  priority: string | null;
  status: string;
  resolved: boolean;
  parentId: string | null;
  createdAt: Date;
  guestName: string | null;
  guestEmail: string | null;
  author: {
    id: string;
    name: string | null;
    professionalName: string | null;
    image: string | null;
  } | null;
  replies?: AnnotationSource[];
};

function serializeAnnotation(a: AnnotationSource): ReviewAnnotationRecord {
  return {
    id: a.id,
    type: a.type,
    layer: a.layer,
    pageIndex: a.pageIndex,
    lineIndex: a.lineIndex,
    anchorText: a.anchorText,
    body: a.body,
    data: (a.data as Record<string, unknown> | null) ?? null,
    priority: a.priority,
    status: a.status,
    resolved: a.resolved,
    parentId: a.parentId,
    createdAt: a.createdAt.toISOString(),
    guestName: a.guestName,
    guestEmail: a.guestEmail,
    author: a.author,
    replies: a.replies?.map(serializeAnnotation),
  };
}

export async function GET() {
  const guest = await getActiveScriptReviewGuest();
  if (!guest) {
    return NextResponse.json({ error: "Guest session required" }, { status: 401 });
  }

  const reviewSession = await prisma.scriptReviewSession.findFirst({
    where: { id: guest.reviewSessionId, projectId: guest.projectId },
    include: {
      annotations: {
        where: { parentId: null },
        include: annotationInclude,
        orderBy: { createdAt: "asc" },
      },
    },
  });
  if (!reviewSession) {
    return NextResponse.json({ error: "Review session not found" }, { status: 404 });
  }

  const draft = await resolveScriptReviewDraftContent(reviewSession);
  if (!draft) {
    return NextResponse.json({ error: "Script draft not found" }, { status: 404 });
  }

  return NextResponse.json({
    guest: {
      name: guest.guestName,
      email: guest.guestEmail,
      inviterName: guest.inviterName,
      expiresAt: guest.expiresAt?.toISOString() ?? null,
    },
    session: {
      id: reviewSession.id,
      draftKey: reviewSession.draftKey,
      reviewStatus: reviewSession.reviewStatus,
      annotations: reviewSession.annotations.map(serializeAnnotation),
    },
    draft: {
      title: draft.title,
      content: draft.content,
    },
  });
}
