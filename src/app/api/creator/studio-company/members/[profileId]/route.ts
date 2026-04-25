import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isMissingCreatorStudioInfrastructure } from "@/lib/prisma-missing-table";

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ profileId: string }> },
) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string })?.id;
  const role = (session?.user as { role?: string })?.role;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (role !== "CONTENT_CREATOR" && role !== "MUSIC_CREATOR") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { profileId } = await ctx.params;
  const body = (await req.json().catch(() => null)) as { pipelineDisabledByAdmin?: boolean } | null;
  if (typeof body?.pipelineDisabledByAdmin !== "boolean") {
    return NextResponse.json({ error: "pipelineDisabledByAdmin boolean required" }, { status: 400 });
  }

  try {
    const profile = await prisma.creatorStudioProfile.findUnique({
      where: { id: profileId },
      include: { company: true },
    });
    if (!profile?.companyId || !profile.company) {
      return NextResponse.json({ error: "Profile is not under a studio company." }, { status: 400 });
    }
    if (profile.company.ownerUserId !== userId) {
      return NextResponse.json({ error: "Only the company owner may change member pipeline access." }, { status: 403 });
    }

    await prisma.creatorStudioProfile.update({
      where: { id: profileId },
      data: { pipelineDisabledByAdmin: body.pipelineDisabledByAdmin },
    });

    return NextResponse.json({ ok: true, profileId, pipelineDisabledByAdmin: body.pipelineDisabledByAdmin });
  } catch (e) {
    if (isMissingCreatorStudioInfrastructure(e)) {
      return NextResponse.json(
        {
          error: "Studio company tables are not on this database yet. Apply Prisma migrations.",
          code: "STUDIO_TABLES_MISSING",
        },
        { status: 503 },
      );
    }
    throw e;
  }
}
