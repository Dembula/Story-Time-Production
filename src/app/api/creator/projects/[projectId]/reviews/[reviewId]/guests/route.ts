import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getCanonicalPublicBaseUrl } from "@/lib/app-url";
import { sendTransactionalEmail } from "@/lib/email";
import {
  durationLabel,
  expiresAtForDuration,
  guestInvitePath,
  isEditReviewGuestDurationKey,
  isInviteActive,
  newInviteToken,
  type EditReviewGuestDurationKey,
} from "@/lib/edit-review/guest-access";

async function ensureCreatorAccess(projectId: string) {
  const session = await getServerSession(authOptions);
  const role = (session?.user as { role?: string })?.role;
  const userId = (session?.user as { id?: string })?.id;
  if (!session || !userId || (role !== "CONTENT_CREATOR" && role !== "ADMIN")) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }), userId: null as string | null };
  }
  if (role === "ADMIN") return { error: null as NextResponse | null, userId };

  const project = await prisma.originalProject.findUnique({
    where: { id: projectId },
    include: { members: true, pitches: true },
  });
  if (!project) {
    return { error: NextResponse.json({ error: "Not found" }, { status: 404 }), userId: null as string | null };
  }
  const ok =
    project.members.some((m) => m.userId === userId) ||
    project.pitches.some((p) => p.creatorId === userId);
  if (!ok) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }), userId: null as string | null };
  }
  return { error: null as NextResponse | null, userId };
}

function serializeInvite(invite: {
  id: string;
  token: string;
  email: string | null;
  durationKey: string;
  expiresAt: Date | null;
  revokedAt: Date | null;
  createdAt: Date;
}) {
  const base = getCanonicalPublicBaseUrl() || "";
  const path = guestInvitePath(invite.token);
  return {
    id: invite.id,
    token: invite.token,
    email: invite.email,
    durationKey: invite.durationKey,
    durationLabel: durationLabel(invite.durationKey),
    expiresAt: invite.expiresAt?.toISOString() ?? null,
    revokedAt: invite.revokedAt?.toISOString() ?? null,
    createdAt: invite.createdAt.toISOString(),
    active: isInviteActive(invite),
    url: base ? `${base}${path}` : path,
  };
}

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ projectId: string; reviewId: string }> },
) {
  const { projectId, reviewId } = await context.params;
  const access = await ensureCreatorAccess(projectId);
  if (access.error) return access.error;

  const review = await prisma.postProductionReview.findFirst({
    where: { id: reviewId, projectId },
    select: { id: true },
  });
  if (!review) return NextResponse.json({ error: "Review not found" }, { status: 404 });

  const invites = await prisma.editReviewGuestInvite.findMany({
    where: { reviewId, projectId },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ invites: invites.map(serializeInvite) });
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ projectId: string; reviewId: string }> },
) {
  const { projectId, reviewId } = await context.params;
  const access = await ensureCreatorAccess(projectId);
  if (access.error) return access.error;
  const userId = access.userId!;

  const body = (await req.json().catch(() => null)) as
    | { durationKey?: string; email?: string; sendEmail?: boolean }
    | null;

  const durationKeyRaw = body?.durationKey?.trim() || "7d";
  if (!isEditReviewGuestDurationKey(durationKeyRaw)) {
    return NextResponse.json({ error: "Invalid duration" }, { status: 400 });
  }
  const durationKey = durationKeyRaw as EditReviewGuestDurationKey;
  const email = body?.email?.trim().toLowerCase() || null;
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "Invalid email" }, { status: 400 });
  }

  const review = await prisma.postProductionReview.findFirst({
    where: { id: reviewId, projectId },
    include: {
      cutAsset: { select: { label: true } },
    },
  });
  if (!review) return NextResponse.json({ error: "Review not found" }, { status: 404 });

  const creator = await prisma.user.findUnique({
    where: { id: userId },
    select: { name: true, professionalName: true, email: true },
  });
  const creatorName =
    creator?.professionalName?.trim() ||
    creator?.name?.trim() ||
    creator?.email?.split("@")[0] ||
    "A Story Time creator";

  const expiresAt = expiresAtForDuration(durationKey);
  const invite = await prisma.editReviewGuestInvite.create({
    data: {
      reviewId,
      projectId,
      createdById: userId,
      token: newInviteToken(),
      email,
      durationKey,
      expiresAt,
    },
  });

  const serialized = serializeInvite(invite);
  let emailSent = false;

  if (email && body?.sendEmail !== false) {
    const cutLabel = review.title || review.cutAsset?.label || "an edit";
    emailSent = await sendTransactionalEmail({
      to: email,
      subject: `${creatorName} invited you to review a cut on Story Time`,
      html: `
        <div style="font-family:system-ui,sans-serif;line-height:1.5;color:#0f172a">
          <p><strong>${creatorName}</strong> invited you to join <strong>Edit Review</strong> as a guest.</p>
          <p>You'll be able to watch <em>${cutLabel}</em> and leave timestamped comments. No Story Time account required.</p>
          <p><a href="${serialized.url}" style="display:inline-block;background:#f97316;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none;font-weight:600">Open guest review</a></p>
          <p style="font-size:12px;color:#64748b">Access lasts: ${durationLabel(durationKey)}${expiresAt ? ` · until ${expiresAt.toLocaleString()}` : ""}.</p>
        </div>
      `,
      text: `${creatorName} invited you to review "${cutLabel}" on Story Time Edit Review.\n\nOpen: ${serialized.url}\nAccess: ${durationLabel(durationKey)}`,
    });
  }

  return NextResponse.json({ invite: serialized, emailSent }, { status: 201 });
}

export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ projectId: string; reviewId: string }> },
) {
  const { projectId, reviewId } = await context.params;
  const access = await ensureCreatorAccess(projectId);
  if (access.error) return access.error;

  const inviteId =
    req.nextUrl.searchParams.get("inviteId")?.trim() ||
    ((await req.json().catch(() => null)) as { inviteId?: string } | null)?.inviteId?.trim();

  if (!inviteId) {
    return NextResponse.json({ error: "inviteId is required" }, { status: 400 });
  }

  const invite = await prisma.editReviewGuestInvite.findFirst({
    where: { id: inviteId, reviewId, projectId },
  });
  if (!invite) return NextResponse.json({ error: "Invite not found" }, { status: 404 });

  await prisma.editReviewGuestInvite.update({
    where: { id: invite.id },
    data: { revokedAt: new Date() },
  });

  return NextResponse.json({ ok: true });
}
