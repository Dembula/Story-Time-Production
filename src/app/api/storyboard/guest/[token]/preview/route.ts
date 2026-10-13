import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  durationLabel,
  isStoryboardInviteActive,
} from "@/lib/storyboard/guest-access";

const db = prisma as any;

type RouteCtx = { params: Promise<{ token: string }> };

export async function GET(_req: NextRequest, ctx: RouteCtx) {
  const { token } = await ctx.params;
  const invite = await db.storyboardGuestInvite.findUnique({
    where: { token },
    include: {
      board: {
        select: {
          id: true,
          title: true,
          stylePreset: true,
          aspectRatio: true,
          status: true,
          project: { select: { title: true } },
        },
      },
    },
  });

  if (!invite || !isStoryboardInviteActive(invite)) {
    return NextResponse.json({ error: "Invite is invalid or expired." }, { status: 404 });
  }

  return NextResponse.json({
    boardTitle: invite.board.title,
    projectTitle: invite.board.project.title,
    stylePreset: invite.board.stylePreset,
    aspectRatio: invite.board.aspectRatio,
    durationLabel: durationLabel(invite.durationKey),
    expiresAt: invite.expiresAt?.toISOString() ?? null,
  });
}
