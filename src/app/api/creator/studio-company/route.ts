import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isMissingCreatorStudioInfrastructure } from "@/lib/prisma-missing-table";

/** Company admin: list owned studio companies and member profiles (same company). */
export async function GET() {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string })?.id;
  const role = (session?.user as { role?: string })?.role;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (role !== "CONTENT_CREATOR" && role !== "MUSIC_CREATOR") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let companies;
  try {
    companies = await prisma.studioCompany.findMany({
      where: { ownerUserId: userId },
      orderBy: { createdAt: "asc" },
      include: {
        profiles: {
          orderBy: { createdAt: "asc" },
          include: {
            user: { select: { id: true, email: true, name: true } },
          },
        },
      },
    });
  } catch (e) {
    if (isMissingCreatorStudioInfrastructure(e)) {
      return NextResponse.json({ companies: [] });
    }
    throw e;
  }

  return NextResponse.json({
    companies: companies.map((c) => ({
      id: c.id,
      displayName: c.displayName,
      seatCap: c.seatCap,
      profiles: c.profiles.map((p) => ({
        id: p.id,
        displayName: p.displayName,
        kind: p.kind,
        userId: p.userId,
        pipelineDisabledByAdmin: p.pipelineDisabledByAdmin,
        user: p.user,
      })),
    })),
  });
}
