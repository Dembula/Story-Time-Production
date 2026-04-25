import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ensureCreatorStudioProfilesForUser } from "@/lib/creator-studio";
import { isMissingCreatorStudioInfrastructure } from "@/lib/prisma-missing-table";
import { findUserActiveStudioProfileId } from "@/lib/prisma-user-studio-compat";

export async function GET() {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string })?.id;
  const role = (session?.user as { role?: string })?.role;
  if (!session?.user?.email || !userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (role !== "CONTENT_CREATOR" && role !== "MUSIC_CREATOR") {
    return NextResponse.json({ profiles: [], companies: [], activeCreatorStudioProfileId: null });
  }

  await ensureCreatorStudioProfilesForUser(userId);

  const prismaExt = prisma as unknown as {
    creatorStudioProfile?: { findMany: (args: object) => Promise<unknown[]> };
    studioCompany?: { findMany: (args: object) => Promise<unknown[]> };
  };
  if (
    typeof prismaExt.creatorStudioProfile?.findMany !== "function" ||
    typeof prismaExt.studioCompany?.findMany !== "function"
  ) {
    const activeCreatorStudioProfileId = await findUserActiveStudioProfileId(userId);
    return NextResponse.json({
      activeCreatorStudioProfileId,
      profiles: [],
      companies: [],
    });
  }

  try {
    const [activeCreatorStudioProfileId, profiles, companies] = await Promise.all([
      findUserActiveStudioProfileId(userId),
      prisma.creatorStudioProfile.findMany({
        where: { userId },
        orderBy: { createdAt: "asc" },
        include: {
          company: { select: { id: true, displayName: true, seatCap: true, ownerUserId: true } },
        },
      }),
      prisma.studioCompany.findMany({
        where: { ownerUserId: userId },
        orderBy: { createdAt: "asc" },
      }),
    ]);

    return NextResponse.json({
      activeCreatorStudioProfileId,
      profiles: profiles.map((p) => ({
        id: p.id,
        displayName: p.displayName,
        kind: p.kind,
        companyId: p.companyId,
        pipelineDisabledByAdmin: p.pipelineDisabledByAdmin,
        company: p.company,
      })),
      companies: companies.map((c) => ({ id: c.id, displayName: c.displayName, seatCap: c.seatCap })),
    });
  } catch (e) {
    if (isMissingCreatorStudioInfrastructure(e)) {
      const activeCreatorStudioProfileId = await findUserActiveStudioProfileId(userId);
      return NextResponse.json({
        activeCreatorStudioProfileId,
        profiles: [],
        companies: [],
      });
    }
    throw e;
  }
}
