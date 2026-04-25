import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isMissingUserStudioWorkspacePrismaField } from "@/lib/prisma-missing-table";

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string })?.id;
  const role = (session?.user as { role?: string })?.role;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (role !== "CONTENT_CREATOR" && role !== "MUSIC_CREATOR") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await req.json().catch(() => null)) as { profileId?: string } | null;
  const profileId = typeof body?.profileId === "string" ? body.profileId.trim() : "";
  if (!profileId) {
    return NextResponse.json({ error: "profileId is required", code: "PROFILE_NOT_LINKED" }, { status: 400 });
  }

  if (
    typeof (prisma as unknown as { creatorStudioProfile?: { findFirst: unknown } }).creatorStudioProfile?.findFirst !==
    "function"
  ) {
    return NextResponse.json(
      {
        error:
          "Studio profiles are not available on this server build. Run `npx prisma generate` and restart.",
        code: "STUDIO_PRISMA_UNSUPPORTED",
      },
      { status: 503 },
    );
  }

  const profile = await prisma.creatorStudioProfile.findFirst({
    where: { id: profileId, userId },
    select: { id: true },
  });
  if (!profile) {
    return NextResponse.json(
      { error: "Profile not found or not linked to your account.", code: "PROFILE_NOT_LINKED" },
      { status: 404 },
    );
  }

  try {
    await prisma.user.update({
      where: { id: userId },
      data: { activeCreatorStudioProfileId: profileId },
    });
  } catch (e) {
    if (isMissingUserStudioWorkspacePrismaField(e)) {
      return NextResponse.json(
        {
          error:
            "This server build is missing the active studio profile field. Run `npx prisma generate` and restart, then try again.",
          code: "ACTIVE_PROFILE_PRISMA_UNSUPPORTED",
        },
        { status: 503 },
      );
    }
    throw e;
  }

  return NextResponse.json({ ok: true, activeCreatorStudioProfileId: profileId });
}
