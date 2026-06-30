import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const contractInclude = {
  project: { select: { id: true, title: true } },
  versions: { orderBy: { version: "desc" as const }, take: 1 },
  signers: true,
  signatures: true,
};

/** Contracts visible to the signed-in stakeholder (casting, crew, location, equipment, catering). */
export async function GET() {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string })?.id;
  const role = (session?.user as { role?: string })?.role;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (role === "CASTING_AGENCY") {
    const agency = await prisma.castingAgency.findFirst({ where: { userId }, select: { id: true } });
    if (agency) {
      const talentIds = await prisma.castingTalent.findMany({
        where: { castingAgencyId: agency.id },
        select: { id: true },
      });
      return NextResponse.json({
        contracts: await prisma.projectContract.findMany({
          where: { castingTalentId: { in: talentIds.map((t) => t.id) } },
          orderBy: { createdAt: "desc" },
          include: contractInclude,
        }),
        role,
      });
    }
  }

  if (role === "CREW_TEAM") {
    const team = await prisma.crewTeam.findFirst({ where: { userId }, select: { id: true } });
    if (team) {
      return NextResponse.json({
        contracts: await prisma.projectContract.findMany({
          where: { OR: [{ counterpartyUserId: userId }, { crewTeamId: team.id }] },
          orderBy: { createdAt: "desc" },
          include: contractInclude,
        }),
        role,
      });
    }
  }

  if (role === "LOCATION_OWNER") {
    const listings = await prisma.locationListing.findMany({ where: { companyId: userId }, select: { id: true } });
    return NextResponse.json({
      contracts: await prisma.projectContract.findMany({
        where: {
          OR: [
            { counterpartyUserId: userId },
            { locationListingId: { in: listings.map((l) => l.id) } },
          ],
        },
        orderBy: { createdAt: "desc" },
        include: contractInclude,
      }),
      role,
    });
  }

  if (role === "EQUIPMENT_COMPANY") {
    const company = await prisma.user.findUnique({
      where: { id: userId },
      select: { name: true, professionalName: true },
    });
    const vendorLabel = company?.professionalName ?? company?.name ?? "";
    return NextResponse.json({
      contracts: await prisma.projectContract.findMany({
        where: {
          OR: [
            { counterpartyUserId: userId },
            ...(vendorLabel ?
              [{ type: "VENDOR", vendorName: { contains: vendorLabel, mode: "insensitive" as const } }]
            : []),
          ],
        },
        orderBy: { createdAt: "desc" },
        include: contractInclude,
      }),
      role,
    });
  }

  if (role === "CATERING_COMPANY") {
    const catering = await prisma.cateringCompany.findFirst({ where: { userId }, select: { id: true, companyName: true } });
    return NextResponse.json({
      contracts: await prisma.projectContract.findMany({
        where: {
          OR: [
            { counterpartyUserId: userId },
            ...(catering ?
              [
                {
                  type: "VENDOR",
                  OR: [
                    { vendorName: { contains: catering.companyName, mode: "insensitive" as const } },
                    { recipientType: "VENDOR" },
                  ],
                },
              ]
            : []),
          ],
        },
        orderBy: { createdAt: "desc" },
        include: contractInclude,
      }),
      role,
    });
  }

  const contracts = await prisma.projectContract.findMany({
    where: { counterpartyUserId: userId },
    orderBy: { createdAt: "desc" },
    include: contractInclude,
  });

  return NextResponse.json({ contracts, role });
}
