import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/** Owner: cancel a pending invite. */
export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ inviteId: string }> },
) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string })?.id;
  const role = (session?.user as { role?: string })?.role;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (role !== "CONTENT_CREATOR" && role !== "MUSIC_CREATOR") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { inviteId } = await ctx.params;
  const invite = await prisma.creatorStudioTeamInvite.findUnique({
    where: { id: inviteId },
    include: { company: { select: { ownerUserId: true } } },
  });
  if (!invite) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (invite.company.ownerUserId !== userId) {
    return NextResponse.json({ error: "Only the company owner can cancel invites." }, { status: 403 });
  }
  if (invite.status !== "PENDING") {
    return NextResponse.json({ error: "Only pending invites can be cancelled." }, { status: 400 });
  }

  await prisma.creatorStudioTeamInvite.update({
    where: { id: inviteId },
    data: { status: "CANCELLED" },
  });
  return NextResponse.json({ ok: true });
}
