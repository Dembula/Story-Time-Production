import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isInviteActive } from "@/lib/edit-review/guest-access";

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ token: string }> },
) {
  const { token: raw } = await context.params;
  const token = decodeURIComponent(raw || "").trim();
  if (!token) {
    return NextResponse.json({ valid: false, error: "Missing invite token" }, { status: 400 });
  }

  const invite = await prisma.editReviewGuestInvite.findUnique({
    where: { token },
    include: {
      createdBy: { select: { name: true, professionalName: true, email: true } },
      review: {
        select: {
          id: true,
          title: true,
          cutAsset: { select: { label: true } },
        },
      },
    },
  });

  if (!invite || !isInviteActive(invite)) {
    return NextResponse.json(
      {
        valid: false,
        error: invite?.revokedAt
          ? "This invite link has been revoked."
          : "This invite link is invalid or has expired.",
      },
      { status: 404 },
    );
  }

  const inviterName =
    invite.createdBy.professionalName?.trim() ||
    invite.createdBy.name?.trim() ||
    invite.createdBy.email?.split("@")[0] ||
    "A Story Time creator";

  return NextResponse.json({
    valid: true,
    inviterName,
    reviewTitle: invite.review.title || invite.review.cutAsset?.label || "Edit review",
    durationKey: invite.durationKey,
    expiresAt: invite.expiresAt?.toISOString() ?? null,
    emailHint: invite.email,
  });
}
