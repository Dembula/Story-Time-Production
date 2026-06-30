import { prisma } from "@/lib/prisma";
import type {
  StakeholderActivityItem,
  StakeholderApprovalItem,
  StakeholderCalendarItem,
  StakeholderPortalKey,
  StakeholderTaskItem,
  StakeholderWorkspaceOverview,
} from "./types";
import { portalFromRole } from "./portal-nav";
import { inventoryWorkspaceSummary } from "./equipment-inventory-service";
import { mealForecastSummary } from "./meal-forecast-service";
import { getFunderBloombergAnalytics } from "./funder-analytics-service";
import { bookingsForLocationContext, listManagedListings, listOwnerListings } from "./location-manager-service";

function quickActions(portal: StakeholderPortalKey): StakeholderWorkspaceOverview["quickActions"] {
  const map: Record<StakeholderPortalKey, StakeholderWorkspaceOverview["quickActions"]> = {
    "casting-agency": [
      { href: "/casting-agency/talent", label: "Add talent", description: "Expand your roster" },
      { href: "/casting-agency/auditions", label: "Post audition", description: "Open a casting call" },
      { href: "/casting-agency/inquiries", label: "Review inquiries", description: "Creator requests" },
      { href: "/casting-agency/contracts", label: "Contracts", description: "Representation & deals" },
    ],
    "crew-team": [
      { href: "/crew-team/team", label: "Update roster", description: "Rates & availability" },
      { href: "/crew-team/requests", label: "Request inbox", description: "Respond to hires" },
      { href: "/crew-team/invitations", label: "Project invites", description: "Production pipeline" },
    ],
    "location-owner": [
      { href: "/location-owner/listings", label: "Add property", description: "List a new location" },
      { href: "/location-owner/bookings", label: "Booking inbox", description: "Approve or decline" },
      { href: "/location-owner/messages", label: "Messages", description: "Production communication" },
    ],
    "equipment-company": [
      { href: "/equipment-company/listings", label: "Add kit", description: "Fleet catalog" },
      { href: "/equipment-company/inventory", label: "RFID inventory", description: "Asset tags & scans" },
      { href: "/equipment-company/requests", label: "Rental inbox", description: "Pending requests" },
      { href: "/equipment-company/messages", label: "Messages", description: "Client coordination" },
    ],
    "catering-company": [
      { href: "/catering-company/profile", label: "Update menu", description: "Menus & allergens" },
      { href: "/catering-company/forecast", label: "Meal forecast", description: "Headcounts & diets" },
      { href: "/catering-company/bookings", label: "Bookings", description: "Event confirmations" },
      { href: "/catering-company/revenue", label: "Revenue", description: "Analytics" },
    ],
    funders: [
      { href: "/funders/opportunities", label: "Opportunities", description: "Browse projects" },
      { href: "/funders/analytics", label: "Market analytics", description: "Portfolio charts" },
      { href: "/funders/deals", label: "Deal pipeline", description: "Active negotiations" },
      { href: "/funders/portfolio", label: "Portfolio", description: "Performance analytics" },
    ],
  };
  return map[portal];
}

async function buildCastingWorkspace(userId: string, portal: StakeholderPortalKey): Promise<Partial<StakeholderWorkspaceOverview>> {
  const agency = await prisma.castingAgency.findFirst({ where: { userId }, select: { id: true, agencyName: true } });
  if (!agency) return { greeting: "Welcome", summary: "Complete your agency profile to unlock the full workspace." };

  const [inquiries, invitations, submissions, contracts, productions] = await Promise.all([
    prisma.castingInquiry.findMany({
      where: { agencyId: agency.id, status: "PENDING" },
      take: 8,
      orderBy: { createdAt: "desc" },
      include: { creator: { select: { name: true } } },
    }),
    prisma.castingInvitation.findMany({
      where: { castingAgencyId: agency.id, status: "PENDING" },
      take: 8,
      orderBy: { createdAt: "desc" },
      include: { project: { select: { title: true } }, role: { select: { name: true } } },
    }),
    prisma.castingAuditionSubmission.findMany({
      where: { castingAgencyId: agency.id, status: { in: ["SUBMITTED", "SHORTLISTED", "CALLBACK"] } },
      take: 5,
      orderBy: { updatedAt: "desc" },
      include: { talent: { select: { name: true } } },
    }),
    prisma.projectContract.findMany({
      where: {
        castingTalent: { castingAgencyId: agency.id },
        status: { in: ["SENT", "VIEWED", "PARTIALLY_SIGNED", "AWAITING_SIGNATURE"] },
      },
      take: 6,
      select: { id: true, subject: true, status: true, signatureDeadline: true, project: { select: { title: true } } },
    }),
    prisma.castingInvitation.count({
      where: { castingAgencyId: agency.id, status: { in: ["PENDING", "ACCEPTED"] } },
    }),
  ]);

  const tasks: StakeholderTaskItem[] = [
    ...inquiries.map((i) => ({
      id: `inq-${i.id}`,
      title: i.projectName ?? "Casting inquiry",
      subtitle: i.roleName ? `${i.roleName} · from ${i.creator.name ?? "creator"}` : undefined,
      priority: "HIGH" as const,
      href: "/casting-agency/inquiries",
      kind: "INQUIRY",
    })),
    ...invitations.map((i) => ({
      id: `inv-${i.id}`,
      title: `Project invite: ${i.project.title}`,
      subtitle: i.role?.name ?? undefined,
      priority: "MEDIUM" as const,
      href: "/casting-agency/invitations",
      kind: "INVITATION",
    })),
  ];

  const approvals: StakeholderApprovalItem[] = contracts.map((c) => ({
    id: c.id,
    title: `${c.project.title}: ${c.subject ?? "Contract"}`,
    status: c.status,
    href: "/casting-agency/contracts",
  }));

  const calendar: StakeholderCalendarItem[] = submissions.map((s) => ({
    id: s.id,
    title: `Audition: ${s.talent?.name ?? "Talent"}`,
    date: s.updatedAt.toISOString(),
    kind: "AUDITION",
    href: "/casting-agency/auditions",
  }));

  const alerts: string[] = [];
  if (inquiries.length > 0) alerts.push(`${inquiries.length} casting inquiry(ies) awaiting response.`);
  if (contracts.length > 0) alerts.push(`${contracts.length} contract(s) need signature or review.`);

  return {
    greeting: agency.agencyName,
    summary: "Talent pipeline, auditions, and production contracts — connected to creator casting calls across Story Time.",
    tasks: tasks.slice(0, 12),
    calendar,
    approvals,
    alerts,
    connectedProductions: productions,
  };
}

async function buildCrewWorkspace(userId: string): Promise<Partial<StakeholderWorkspaceOverview>> {
  const team = await prisma.crewTeam.findUnique({
    where: { userId },
    select: { id: true, companyName: true },
  });
  if (!team) return { greeting: "Welcome", summary: "Set up your crew company profile to connect with productions." };

  const [requests, invitations, contracts] = await Promise.all([
    prisma.crewTeamRequest.findMany({
      where: { crewTeamId: team.id, status: "PENDING" },
      take: 10,
      orderBy: { createdAt: "desc" },
      include: { creator: { select: { name: true } } },
    }),
    prisma.crewInvitation.findMany({
      where: { crewTeamId: team.id, status: "PENDING" },
      take: 10,
      orderBy: { createdAt: "desc" },
      include: { project: { select: { title: true } }, need: { select: { role: true } } },
    }),
    prisma.projectContract.count({
      where: { crewTeamId: team.id, status: { in: ["SENT", "AWAITING_SIGNATURE", "PARTIALLY_SIGNED"] } },
    }),
  ]);

  const tasks: StakeholderTaskItem[] = [
    ...requests.map((r) => ({
      id: `req-${r.id}`,
      title: "Crew hire request",
      subtitle: r.creator.name ?? undefined,
      priority: "HIGH" as const,
      href: "/crew-team/requests",
      kind: "REQUEST",
    })),
    ...invitations.map((i) => ({
      id: `ci-${i.id}`,
      title: i.project.title,
      subtitle: i.need.role,
      priority: "MEDIUM" as const,
      href: "/crew-team/invitations",
      kind: "PROJECT_INVITE",
    })),
  ];

  const alerts: string[] = [];
  if (requests.length) alerts.push(`${requests.length} hire request(s) in your inbox.`);
  if (contracts > 0) alerts.push(`${contracts} crew contract(s) awaiting signature.`);

  return {
    greeting: team.companyName,
    summary: "Call sheets, project invites, timesheets, and contracts — synced with creator production schedules.",
    tasks,
    calendar: invitations.map((i) => ({
      id: i.id,
      title: `Shoot prep: ${i.project.title}`,
      date: i.createdAt.toISOString(),
      kind: "PROJECT",
      href: "/crew-team/invitations",
    })),
    approvals: [],
    alerts,
    connectedProductions: invitations.length,
  };
}

async function buildLocationWorkspace(userId: string, mode: "owner" | "manager" = "owner"): Promise<Partial<StakeholderWorkspaceOverview>> {
  const managed = await listManagedListings(userId);
  const owned = await listOwnerListings(userId);
  const effectiveMode = mode === "manager" && managed.length > 0 ? "manager" : "owner";

  const bookings = await bookingsForLocationContext(userId, effectiveMode);
  const pending = bookings.filter((b) => b.status === "PENDING");

  const tasks: StakeholderTaskItem[] = pending.map((b) => ({
    id: b.id,
    title: `Booking: ${b.location.name}`,
    subtitle: b.requester.name ?? undefined,
    priority: "HIGH" as const,
    href: effectiveMode === "manager" ? "/location-owner/manager" : "/location-owner/bookings",
    kind: "BOOKING",
    dueAt: b.startDate ?? null,
  }));

  const listingCount = effectiveMode === "manager" ? managed.length : owned.length;

  return {
    greeting: effectiveMode === "manager" ? "Location manager" : "Location portfolio",
    summary:
      effectiveMode === "manager"
        ? "On-site manager view — bookings and access for assigned properties only."
        : "Bookings, permits, and production access — every reservation ties to active creator projects.",
    tasks,
    calendar: bookings
      .filter((b) => b.startDate)
      .map((b) => ({
        id: b.id,
        title: b.location.name,
        date: b.startDate!,
        endDate: b.endDate,
        kind: "BOOKING",
        href: effectiveMode === "manager" ? "/location-owner/manager" : "/location-owner/bookings",
      })),
    alerts: pending.length ? [`${pending.length} booking(s) need your approval.`] : [],
    connectedProductions: bookings.filter((b) => b.status === "APPROVED").length,
    locationContext: { mode: effectiveMode, listingCount },
  };
}

async function buildEquipmentWorkspace(userId: string): Promise<Partial<StakeholderWorkspaceOverview>> {
  const requests = await prisma.equipmentRequest.findMany({
    where: { companyId: userId, status: "PENDING" },
    take: 12,
    orderBy: { createdAt: "desc" },
    include: {
      equipment: { select: { companyName: true, category: true } },
      requester: { select: { name: true } },
    },
  });

  const tasks: StakeholderTaskItem[] = requests.map((r) => ({
    id: r.id,
    title: `${r.equipment.companyName} rental`,
    subtitle: `${r.equipment.category} · ${r.requester.name ?? "Creator"}`,
    priority: "HIGH" as const,
    href: "/equipment-company/requests",
    kind: "RENTAL",
    dueAt: r.startDate ?? null,
  }));

  return {
    greeting: "Equipment operations",
    summary: "Inventory, reservations, and rental pipeline — linked to production equipment plans.",
    tasks,
    calendar: requests
      .filter((r) => r.startDate)
      .map((r) => ({
        id: r.id,
        title: r.equipment.companyName,
        date: r.startDate!,
        endDate: r.endDate,
        kind: "RENTAL",
        href: "/equipment-company/requests",
      })),
    alerts: tasks.length ? [`${tasks.length} rental request(s) pending approval.`] : [],
    connectedProductions: requests.length,
    moduleInsights: { inventory: await inventoryWorkspaceSummary(userId) },
  };
}

async function buildCateringWorkspace(userId: string): Promise<Partial<StakeholderWorkspaceOverview>> {
  const company = await prisma.cateringCompany.findFirst({ where: { userId }, select: { id: true, companyName: true } });
  const bookings = await prisma.cateringBooking.findMany({
    where: { cateringCompany: { userId } },
    orderBy: { createdAt: "desc" },
    take: 12,
    include: {
      cateringCompany: { select: { companyName: true } },
      creator: { select: { name: true } },
    },
  });
  const pending = bookings.filter((b) => b.status === "PENDING");

  const tasks: StakeholderTaskItem[] = pending.map((b) => ({
    id: b.id,
    title: "Catering event request",
    subtitle: b.creator.name ?? undefined,
    priority: "HIGH" as const,
    href: "/catering-company/bookings",
    kind: "CATERING",
    dueAt: b.eventDate ?? null,
  }));

  return {
    greeting: company?.companyName ?? bookings[0]?.cateringCompany.companyName ?? "Catering",
    summary: "Menus, headcounts, and shoot-day meal schedules — integrated with production calendars.",
    tasks,
    calendar: bookings
      .filter((b) => b.eventDate)
      .map((b) => ({
        id: b.id,
        title: `Event · ${b.headCount ?? "?"} guests`,
        date: b.eventDate!,
        kind: "MEAL",
        href: "/catering-company/bookings",
      })),
    alerts: pending.length ? [`${pending.length} catering booking(s) to confirm.`] : [],
    connectedProductions: bookings.filter((b) => b.status === "APPROVED").length,
    moduleInsights: company ? { mealForecast: await mealForecastSummary(company.id) } : undefined,
  };
}

async function buildFunderWorkspace(userId: string): Promise<Partial<StakeholderWorkspaceOverview>> {
  const [deals, opportunities, payouts] = await Promise.all([
    prisma.investmentDeal.findMany({
      where: { funderUserId: userId, pipelineStatus: { notIn: ["REJECTED", "FUNDED"] } },
      take: 8,
      orderBy: { updatedAt: "desc" },
      include: { opportunity: { select: { title: true } } },
    }),
    prisma.investmentOpportunity.count({ where: { status: "OPEN" } }),
    prisma.stakeholderPayout.count({ where: { userId, status: "PENDING" } }),
  ]);

  const tasks: StakeholderTaskItem[] = deals.map((d) => ({
    id: d.id,
    title: d.opportunity.title,
    subtitle: d.pipelineStatus,
    priority: d.pipelineStatus === "NEGOTIATING" ? "HIGH" : "MEDIUM",
    href: "/funders/deals",
    kind: "DEAL",
  }));

  const alerts: string[] = [];
  if (deals.length) alerts.push(`${deals.length} active deal(s) in your pipeline.`);
  if (payouts > 0) alerts.push(`${payouts} pending payout(s) to review.`);

  return {
    greeting: "Investor workspace",
    summary: "Portfolio, milestones, and production progress — one source of truth across funded projects.",
    tasks,
    calendar: deals.map((d) => ({
      id: d.id,
      title: d.opportunity.title,
      date: d.updatedAt.toISOString(),
      kind: "DEAL",
      href: "/funders/deals",
    })),
    alerts,
    connectedProductions: opportunities,
    moduleInsights: { analytics: await getFunderBloombergAnalytics(userId) },
  };
}

export async function buildStakeholderWorkspace(
  userId: string,
  role: string,
  opts?: { locationMode?: "owner" | "manager" },
): Promise<StakeholderWorkspaceOverview | null> {
  const portal = portalFromRole(role);
  if (!portal) return null;

  const [notifications, activityRows] = await Promise.all([
    prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 15,
      select: { id: true, title: true, body: true, type: true, read: true, createdAt: true, metadata: true },
    }),
    prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: { id: true, title: true, body: true, type: true, createdAt: true },
    }),
  ]);

  let roleData: Partial<StakeholderWorkspaceOverview> = {};
  switch (role) {
    case "CASTING_AGENCY":
      roleData = await buildCastingWorkspace(userId, portal);
      break;
    case "CREW_TEAM":
      roleData = await buildCrewWorkspace(userId);
      break;
    case "LOCATION_OWNER":
      roleData = await buildLocationWorkspace(userId, opts?.locationMode ?? "owner");
      break;
    case "EQUIPMENT_COMPANY":
      roleData = await buildEquipmentWorkspace(userId);
      break;
    case "CATERING_COMPANY":
      roleData = await buildCateringWorkspace(userId);
      break;
    case "FUNDER":
      roleData = await buildFunderWorkspace(userId);
      break;
    default:
      return null;
  }

  const activity: StakeholderActivityItem[] = activityRows.map((n) => ({
    id: n.id,
    title: n.title,
    body: n.body,
    at: n.createdAt.toISOString(),
    kind: n.type,
  }));

  const unreadNotifications = notifications.filter((n) => !n.read).length;

  return {
    role,
    portal,
    generatedAt: new Date().toISOString(),
    greeting: roleData.greeting ?? "Story Time",
    summary: roleData.summary ?? "",
    tasks: roleData.tasks ?? [],
    calendar: roleData.calendar ?? [],
    activity,
    approvals: roleData.approvals ?? [],
    alerts: roleData.alerts ?? [],
    unreadNotifications,
    quickActions: quickActions(portal),
    connectedProductions: roleData.connectedProductions ?? 0,
    moduleInsights: roleData.moduleInsights,
    locationContext: roleData.locationContext,
  };
}
