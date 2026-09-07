import "server-only";

import { prisma } from "@/lib/prisma";

export const MARKETPLACE_DOSSIER_TYPES = [
  "crew",
  "cast",
  "locations",
  "equipment",
  "catering",
] as const;

export type MarketplaceDossierType = (typeof MARKETPLACE_DOSSIER_TYPES)[number];

export function isMarketplaceDossierType(value: string): value is MarketplaceDossierType {
  return (MARKETPLACE_DOSSIER_TYPES as readonly string[]).includes(value);
}

type ActivityItem = {
  at: string;
  kind: string;
  label: string;
  status?: string | null;
};

function pushActivity(
  items: ActivityItem[],
  at: Date | string | null | undefined,
  kind: string,
  label: string,
  status?: string | null,
) {
  if (!at) return;
  items.push({
    at: typeof at === "string" ? at : at.toISOString(),
    kind,
    label,
    status: status ?? null,
  });
}

export async function fetchMarketplaceDossier(type: MarketplaceDossierType, id: string) {
  if (type === "crew") {
    const team = await prisma.crewTeam.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            professionalName: true,
            createdAt: true,
          },
        },
        members: {
          orderBy: { sortOrder: "asc" },
          select: {
            id: true,
            name: true,
            role: true,
            department: true,
            dailyRate: true,
            skills: true,
            photoUrl: true,
          },
        },
        requests: {
          orderBy: { createdAt: "desc" },
          take: 40,
          include: {
            creator: { select: { id: true, name: true, email: true } },
          },
        },
        crewInvitations: {
          orderBy: { createdAt: "desc" },
          take: 30,
          select: {
            id: true,
            status: true,
            createdAt: true,
            project: { select: { id: true, title: true } },
            need: { select: { role: true, department: true } },
          },
        },
        projectContracts: {
          orderBy: { createdAt: "desc" },
          take: 20,
          select: {
            id: true,
            type: true,
            status: true,
            createdAt: true,
            project: { select: { id: true, title: true } },
          },
        },
        _count: { select: { members: true, requests: true, crewInvitations: true, projectContracts: true } },
      },
    });
    if (!team) return null;

    const subscription = await prisma.companySubscription.findFirst({
      where: { userId: team.userId, companyType: "CREW_TEAM" },
      orderBy: { updatedAt: "desc" },
      select: { id: true, plan: true, status: true, currentPeriodEnd: true },
    });

    const activity: ActivityItem[] = [];
    for (const r of team.requests) {
      pushActivity(
        activity,
        r.createdAt,
        "request",
        `Crew request from ${r.creator.name || r.creator.email}`,
        r.status,
      );
    }
    for (const inv of team.crewInvitations) {
      const role = inv.need?.role || "role";
      pushActivity(
        activity,
        inv.createdAt,
        "invitation",
        `Project invite: ${inv.project?.title || "Untitled"} (${role})`,
        inv.status,
      );
    }
    for (const c of team.projectContracts) {
      pushActivity(
        activity,
        c.createdAt,
        "contract",
        `Contract · ${c.project?.title || "project"}`,
        c.status,
      );
    }
    activity.sort((a, b) => b.at.localeCompare(a.at));

    return {
      type,
      id: team.id,
      companyName: team.companyName,
      tagline: team.tagline,
      description: team.description,
      website: team.website,
      specializations: team.specializations,
      location: [team.city, team.country].filter(Boolean).join(", ") || team.location,
      logoUrl: team.logoUrl,
      user: team.user,
      subscription,
      counts: team._count,
      roster: team.members,
      requests: team.requests,
      invitations: team.crewInvitations,
      contracts: team.projectContracts,
      activity: activity.slice(0, 50),
    };
  }

  if (type === "cast") {
    const agency = await prisma.castingAgency.findUnique({
      where: { id },
      include: {
        user: {
          select: { id: true, name: true, email: true, professionalName: true, createdAt: true },
        },
        talent: {
          orderBy: { createdAt: "desc" },
          take: 80,
          select: {
            id: true,
            name: true,
            ageRange: true,
            skills: true,
            dailyRate: true,
            headshotUrl: true,
            gender: true,
          },
        },
        inquiries: {
          orderBy: { createdAt: "desc" },
          take: 40,
          include: { creator: { select: { id: true, name: true, email: true } } },
        },
        castingInvitations: {
          orderBy: { createdAt: "desc" },
          take: 30,
          select: {
            id: true,
            status: true,
            createdAt: true,
            project: { select: { id: true, title: true } },
            talent: { select: { id: true, name: true } },
          },
        },
        auditionSubmissions: {
          orderBy: { submittedAt: "desc" },
          take: 30,
          select: {
            id: true,
            status: true,
            submittedAt: true,
            auditionPost: { select: { id: true, roleName: true } },
            talent: { select: { id: true, name: true } },
          },
        },
        _count: {
          select: { talent: true, inquiries: true, castingInvitations: true, auditionSubmissions: true },
        },
      },
    });
    if (!agency) return null;

    const subscription = await prisma.companySubscription.findFirst({
      where: { userId: agency.userId, companyType: "CASTING_AGENCY" },
      orderBy: { updatedAt: "desc" },
      select: { id: true, plan: true, status: true, currentPeriodEnd: true },
    });

    const activity: ActivityItem[] = [];
    for (const q of agency.inquiries) {
      pushActivity(
        activity,
        q.createdAt,
        "inquiry",
        `Inquiry from ${q.creator.name || q.creator.email}`,
        q.status,
      );
    }
    for (const inv of agency.castingInvitations) {
      pushActivity(
        activity,
        inv.createdAt,
        "invitation",
        `Cast invite · ${inv.talent?.name || "talent"} · ${inv.project?.title || "project"}`,
        inv.status,
      );
    }
    for (const sub of agency.auditionSubmissions) {
      pushActivity(
        activity,
        sub.submittedAt,
        "audition",
        `Audition · ${sub.talent?.name || "talent"} for ${sub.auditionPost?.roleName || "role"}`,
        sub.status,
      );
    }
    activity.sort((a, b) => b.at.localeCompare(a.at));

    return {
      type,
      id: agency.id,
      companyName: agency.agencyName,
      tagline: agency.tagline,
      description: agency.description,
      website: agency.website,
      location: [agency.city, agency.country].filter(Boolean).join(", ") || agency.location,
      logoUrl: agency.logoUrl,
      user: agency.user,
      subscription,
      counts: {
        talent: agency._count.talent,
        inquiries: agency._count.inquiries,
        invitations: agency._count.castingInvitations,
        auditionSubmissions: agency._count.auditionSubmissions,
      },
      talent: agency.talent,
      inquiries: agency.inquiries,
      invitations: agency.castingInvitations,
      auditionSubmissions: agency.auditionSubmissions,
      activity: activity.slice(0, 50),
    };
  }

  if (type === "locations") {
    const user = await prisma.user.findFirst({
      where: { id, role: "LOCATION_OWNER" },
      select: { id: true, name: true, email: true, professionalName: true, createdAt: true },
    });
    if (!user) return null;

    const listings = await prisma.locationListing.findMany({
      where: { companyId: id },
      orderBy: { createdAt: "desc" },
      include: {
        _count: { select: { bookings: true, managers: true } },
        managers: {
          take: 10,
          select: {
            id: true,
            role: true,
            canApproveBookings: true,
            user: { select: { id: true, name: true, email: true } },
          },
        },
      },
    });
    const bookings = await prisma.locationBooking.findMany({
      where: { ownerId: id },
      orderBy: { createdAt: "desc" },
      take: 40,
      include: {
        location: { select: { id: true, name: true } },
        requester: { select: { id: true, name: true, email: true } },
      },
    });

    const subscription = await prisma.companySubscription.findFirst({
      where: { userId: id, companyType: "LOCATION_OWNER" },
      orderBy: { updatedAt: "desc" },
      select: { id: true, plan: true, status: true, currentPeriodEnd: true },
    });

    const activity: ActivityItem[] = [];
    for (const b of bookings) {
      pushActivity(
        activity,
        b.createdAt,
        "booking",
        `${b.location?.name || "Location"} · ${b.requester.name || b.requester.email}`,
        b.status,
      );
    }
    for (const l of listings) {
      pushActivity(activity, l.createdAt, "listing", `Listing created: ${l.name}`, l.type);
    }
    activity.sort((a, b) => b.at.localeCompare(a.at));

    return {
      type,
      id: user.id,
      companyName: user.professionalName || user.name || user.email,
      user,
      subscription,
      counts: {
        listings: listings.length,
        bookings: bookings.length,
        openBookings: bookings.filter((b) => b.status === "PENDING" || b.status === "APPROVED").length,
      },
      listings,
      bookings,
      activity: activity.slice(0, 50),
    };
  }

  if (type === "equipment") {
    const user = await prisma.user.findFirst({
      where: { id, role: "EQUIPMENT_COMPANY" },
      select: { id: true, name: true, email: true, professionalName: true, createdAt: true },
    });
    if (!user) return null;

    const listings = await prisma.equipmentListing.findMany({
      where: { companyId: id },
      orderBy: { createdAt: "desc" },
      include: {
        _count: { select: { requests: true, inventoryTags: true } },
      },
    });
    const requests = await prisma.equipmentRequest.findMany({
      where: { companyId: id },
      orderBy: { createdAt: "desc" },
      take: 40,
      include: {
        equipment: { select: { id: true, companyName: true, category: true } },
        requester: { select: { id: true, name: true, email: true } },
      },
    });
    const tags = await prisma.equipmentInventoryTag.findMany({
      where: { companyId: id },
      take: 50,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        rfidTag: true,
        status: true,
        serialNumber: true,
        createdAt: true,
        equipment: { select: { id: true, companyName: true, category: true } },
      },
    });

    const subscription = await prisma.companySubscription.findFirst({
      where: { userId: id, companyType: "EQUIPMENT_COMPANY" },
      orderBy: { updatedAt: "desc" },
      select: { id: true, plan: true, status: true, currentPeriodEnd: true },
    });

    const activity: ActivityItem[] = [];
    for (const r of requests) {
      pushActivity(
        activity,
        r.createdAt,
        "request",
        `${r.equipment?.companyName || "Equipment"} · ${r.requester.name || r.requester.email}`,
        r.status,
      );
    }
    for (const l of listings) {
      pushActivity(activity, l.createdAt, "listing", `Listing: ${l.companyName} (${l.category})`);
    }
    activity.sort((a, b) => b.at.localeCompare(a.at));

    return {
      type,
      id: user.id,
      companyName: user.professionalName || user.name || user.email,
      user,
      subscription,
      counts: {
        listings: listings.length,
        requests: requests.length,
        inventoryTags: tags.length,
      },
      listings,
      requests,
      inventoryTags: tags,
      activity: activity.slice(0, 50),
    };
  }

  const company = await prisma.cateringCompany.findUnique({
    where: { id },
    include: {
      user: { select: { id: true, name: true, email: true, professionalName: true, createdAt: true } },
      bookings: {
        orderBy: { createdAt: "desc" },
        take: 40,
        include: { creator: { select: { id: true, name: true, email: true } } },
      },
      mealForecasts: {
        orderBy: { createdAt: "desc" },
        take: 30,
      },
      _count: { select: { bookings: true, mealForecasts: true } },
    },
  });
  if (!company) return null;

  const subscription = await prisma.companySubscription.findFirst({
    where: { userId: company.userId, companyType: "CATERING_COMPANY" },
    orderBy: { updatedAt: "desc" },
    select: { id: true, plan: true, status: true, currentPeriodEnd: true },
  });

  const activity: ActivityItem[] = [];
  for (const b of company.bookings) {
    pushActivity(
      activity,
      b.createdAt,
      "booking",
      `Catering booking · ${b.creator.name || b.creator.email}${b.quotedAmount != null ? ` · R${b.quotedAmount}` : ""}`,
      b.status,
    );
  }
  for (const f of company.mealForecasts) {
    pushActivity(
      activity,
      f.createdAt,
      "forecast",
      `Meal forecast · ${f.headCount} pax · ${f.eventDate}`,
      f.status,
    );
  }
  activity.sort((a, b) => b.at.localeCompare(a.at));

  return {
    type: "catering" as const,
    id: company.id,
    companyName: company.companyName,
    tagline: company.tagline,
    description: company.description,
    website: company.website,
    specializations: company.specializations,
    location: [company.city, company.country].filter(Boolean).join(", ") || null,
    logoUrl: company.logoUrl,
    user: company.user,
    subscription,
    counts: company._count,
    bookings: company.bookings,
    mealForecasts: company.mealForecasts,
    activity: activity.slice(0, 50),
  };
}
