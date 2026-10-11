import {
  ALL_PROJECT_TOOLS,
  POST_PRODUCTION_TOOLS,
  PRE_PRODUCTION_TOOLS,
  PRODUCTION_TOOLS,
  type ProjectToolMeta,
} from "@/lib/project-tools";
import type { TourDefinition, TourRole } from "@/lib/tours/types";

const CREATOR_ROLES: TourRole[] = ["CONTENT_CREATOR", "ADMIN"];
const STAKEHOLDER_ROLES: TourRole[] = [
  "FUNDER",
  "EQUIPMENT_COMPANY",
  "LOCATION_OWNER",
  "CREW_TEAM",
  "CASTING_AGENCY",
  "CATERING_COMPANY",
  "MUSIC_CREATOR",
];

function matchProjectTool(toolSlug: string) {
  return (pathname: string) =>
    /\/creator\/projects\/[^/]+\/(pre-production|production|post-production)\/([^/?#]+)/.test(
      pathname,
    ) && pathname.includes(`/${toolSlug}`);
}

function matchAnyProjectTool(pathname: string): boolean {
  return /\/creator\/projects\/[^/]+\/(pre-production|production|post-production)\/[^/?#]+/.test(
    pathname,
  );
}

function projectToolTour(tool: ProjectToolMeta): TourDefinition {
  const phaseLabel =
    tool.phase === "PRE_PRODUCTION"
      ? "Pre-Production"
      : tool.phase === "PRODUCTION"
        ? "Production"
        : "Post-Production";

  return {
    id: `creator.tool.${tool.toolSlug}`,
    version: 1,
    title: tool.label,
    roles: CREATOR_ROLES,
    priority: 20,
    match: matchProjectTool(tool.toolSlug),
    startDelayMs: 500,
    steps: [
      {
        id: "workspace",
        title: tool.label,
        body: `${tool.description} This is your project workspace for the ${phaseLabel} phase — changes save against the active project.`,
        target: '[data-tour="tool-workspace-header"]',
      },
      {
        id: "related",
        title: "Related tools",
        body: "Use the links in this header to jump to connected workflow tools without losing your project context.",
        target: '[data-tour="tool-related-links"]',
        optional: true,
      },
      {
        id: "body",
        title: "Work area",
        body: "Primary controls, editors, and lists for this tool live here. Save often, and ask the Virtual Assistant when you need help generating or refining work.",
        target: '[data-tour="tool-workspace-body"]',
      },
      {
        id: "nav",
        title: "Pipeline navigation",
        body: "Open the sidebar to move between Pre-Production, Production, Post-Production, and your projects. Your progress stays on the project.",
        target: '[data-tour="dashboard-sidebar-toggle"]',
      },
    ],
  };
}

const stakeholderPortalHomes: Array<{
  id: string;
  match: (p: string) => boolean;
  title: string;
  homeBody: string;
}> = [
  {
    id: "funders",
    match: (p) => p === "/funders" || p === "/funders/",
    title: "Funder dashboard",
    homeBody:
      "Your funding home shows opportunities, portfolio status, and verification cues so you can act on deals with confidence.",
  },
  {
    id: "equipment-company",
    match: (p) => p === "/equipment-company/dashboard" || p === "/equipment-company/dashboard/",
    title: "Equipment company dashboard",
    homeBody:
      "Track listings, rental requests, and deal activity for your equipment catalogue from this home view.",
  },
  {
    id: "location-owner",
    match: (p) => p === "/location-owner/dashboard" || p === "/location-owner/dashboard/",
    title: "Location owner dashboard",
    homeBody:
      "Manage location listings, booking requests, and manager access from your location portal home.",
  },
  {
    id: "crew-team",
    match: (p) => p === "/crew-team/dashboard" || p === "/crew-team/dashboard/",
    title: "Crew team dashboard",
    homeBody:
      "See inbound crew requests, invitations, and deal progress for your team from this dashboard.",
  },
  {
    id: "casting-agency",
    match: (p) => p === "/casting-agency/dashboard" || p === "/casting-agency/dashboard/",
    title: "Casting agency dashboard",
    homeBody:
      "Oversee talent, auditions, and creator inquiries from your casting agency home.",
  },
  {
    id: "catering-company",
    match: (p) => p === "/catering-company/dashboard" || p === "/catering-company/dashboard/",
    title: "Catering company dashboard",
    homeBody:
      "Monitor bookings, forecasts, and revenue for on-set catering from this home view.",
  },
  {
    id: "music-creator",
    match: (p) => p === "/music-creator/dashboard" || p === "/music-creator/dashboard/",
    title: "Music creator dashboard",
    homeBody:
      "Track uploads, sync requests, scoring work, and revenue for your music catalogue.",
  },
];

function stakeholderHomeTour(cfg: (typeof stakeholderPortalHomes)[number]): TourDefinition {
  return {
    id: `stakeholder.home.${cfg.id}`,
    version: 1,
    title: cfg.title,
    roles: STAKEHOLDER_ROLES,
    priority: 30,
    match: cfg.match,
    startDelayMs: 400,
    steps: [
      {
        id: "home",
        title: cfg.title,
        body: cfg.homeBody,
        target: '[data-tour="stakeholder-home"]',
        optional: true,
      },
      {
        id: "sidebar",
        title: "Portal navigation",
        body: "Use Workspace for Action centre, Calendar, and Activity. Operations links open the tools specific to your business role.",
        target: '[data-tour="dashboard-sidebar"]',
        optional: true,
      },
      {
        id: "menu",
        title: "Menu",
        body: "On smaller screens, open the menu to reach every portal page. Notifications stay available in the header.",
        target: '[data-tour="dashboard-sidebar-toggle"]',
      },
      {
        id: "notifications",
        title: "Notifications",
        body: "Alerts for deals, bookings, and messages appear here so you can respond quickly.",
        target: '[data-tour="header-notifications"]',
        optional: true,
      },
    ],
  };
}

export const TOUR_REGISTRY: TourDefinition[] = [
  {
    id: "creator.command-center",
    version: 1,
    title: "Command Center",
    roles: CREATOR_ROLES,
    priority: 50,
    match: (p) => p === "/creator/command-center" || p.startsWith("/creator/command-center?"),
    startDelayMs: 600,
    steps: [
      {
        id: "intro",
        title: "Welcome to Command Center",
        body: "This is your studio decision layer — audience, monetization, catalogue performance, production health, and AI assistance in one place.",
        target: '[data-tour="cc-title"]',
      },
      {
        id: "calendar",
        title: "Studio calendar",
        body: "Upcoming shoots, deliveries, and key dates surface here so you can plan around real production commitments.",
        target: '[data-tour="cc-calendar"]',
        optional: true,
      },
      {
        id: "snapshot",
        title: "Executive snapshot",
        body: "Quick metrics for views, engagement, and revenue (ZAR) help you spot what needs attention today.",
        target: '[data-tour="cc-snapshot"]',
        optional: true,
      },
      {
        id: "tabs",
        title: "Insight sections",
        body: "Switch between Overview, Audience, Films, Revenue, Team, AI usage, Production, and Export. Tabs you are not licensed for stay hidden.",
        target: '[data-tour="cc-nav"]',
        optional: true,
      },
      {
        id: "sidebar",
        title: "Creator navigation",
        body: "Open My Projects, Pre-Production, Production, Post-Production, Marketplace, Wallet, and more from the sidebar.",
        target: '[data-tour="dashboard-sidebar-toggle"]',
      },
    ],
  },
  {
    id: "creator.dashboard",
    version: 1,
    title: "My Projects",
    roles: CREATOR_ROLES,
    priority: 40,
    match: (p) => p === "/creator/dashboard" || p.startsWith("/creator/dashboard?"),
    startDelayMs: 400,
    steps: [
      {
        id: "title",
        title: "My Projects",
        body: "Every original project you own or collaborate on appears here. Open a project to enter its pre-production, production, and post-production tools.",
        target: '[data-tour="creator-dashboard-title"]',
        optional: true,
      },
      {
        id: "list",
        title: "Project list",
        body: "Create a new project or open an existing one. Pipeline status on each card shows how far planning and delivery have progressed.",
        target: '[data-tour="creator-dashboard-projects"]',
        optional: true,
      },
      {
        id: "nav",
        title: "Sidebar",
        body: "Use the sidebar to jump to Command Center, phase hubs, marketplace, wallet, and account settings.",
        target: '[data-tour="dashboard-sidebar-toggle"]',
      },
    ],
  },
  {
    id: "creator.pre-production",
    version: 1,
    title: "Pre-Production hub",
    roles: CREATOR_ROLES,
    priority: 40,
    match: (p) => p === "/creator/pre-production" || p.startsWith("/creator/pre-production?"),
    startDelayMs: 400,
    steps: [
      {
        id: "hub",
        title: "Pre-Production",
        body: "Ideas, treatments, scripts, breakdowns, budgets, casting, crew, locations, legal, and funding tools all start from this hub.",
        target: '[data-tour="phase-hub-header"]',
      },
      {
        id: "projects",
        title: "Choose a project",
        body: "Pick which project you are working on. Tool shortcuts open that project’s workspace so your work stays organised.",
        target: '[data-tour="phase-hub-projects"]',
        optional: true,
      },
      {
        id: "tools",
        title: "Pre-production tools",
        body: `Jump into any of ${PRE_PRODUCTION_TOOLS.length} tools — workflows are not locked to a single order.`,
        target: '[data-tour="phase-hub-tools"]',
      },
      {
        id: "marketplace",
        title: "Marketplace",
        body: "When you are ready to hire, open Marketplace to browse casting, crew, locations, equipment, and catering partners.",
        target: '[data-tour="phase-hub-footer"]',
        optional: true,
      },
    ],
  },
  {
    id: "creator.production",
    version: 1,
    title: "Production hub",
    roles: CREATOR_ROLES,
    priority: 40,
    match: (p) => p === "/creator/production" || p.startsWith("/creator/production?"),
    startDelayMs: 400,
    steps: [
      {
        id: "hub",
        title: "Production",
        body: "On-set control, call sheets, tasks, dailies, continuity, expenses, and wrap tools live in this phase.",
        target: '[data-tour="phase-hub-header"]',
      },
      {
        id: "projects",
        title: "Choose a project",
        body: "Select the project currently in production so call sheets and shoot tools stay linked to the right schedule.",
        target: '[data-tour="phase-hub-projects"]',
        optional: true,
      },
      {
        id: "tools",
        title: "Production tools",
        body: `Open any of ${PRODUCTION_TOOLS.length} production tools from here — Control Center is the operational hub on set.`,
        target: '[data-tour="phase-hub-tools"]',
      },
    ],
  },
  {
    id: "creator.post-production",
    version: 1,
    title: "Post-Production hub",
    roles: CREATOR_ROLES,
    priority: 40,
    match: (p) => p === "/creator/post-production" || p.startsWith("/creator/post-production?"),
    startDelayMs: 400,
    steps: [
      {
        id: "hub",
        title: "Post-Production",
        body: "Ingest footage, edit, sound, music, VFX, colour, finals, packaging, and distribution from this hub.",
        target: '[data-tour="phase-hub-header"]',
      },
      {
        id: "projects",
        title: "Choose a project",
        body: "Select the project you are finishing so editorial and delivery tools stay attached to the right deliverables.",
        target: '[data-tour="phase-hub-projects"]',
        optional: true,
      },
      {
        id: "tools",
        title: "Post tools",
        body: `Jump into any of ${POST_PRODUCTION_TOOLS.length} post tools. Distribution connects finished work to catalogue upload.`,
        target: '[data-tour="phase-hub-tools"]',
      },
    ],
  },
  {
    id: "creator.marketplace",
    version: 1,
    title: "Marketplace",
    roles: CREATOR_ROLES,
    priority: 35,
    match: (p) => p === "/creator/marketplace" || p.startsWith("/creator/marketplace?"),
    startDelayMs: 400,
    steps: [
      {
        id: "title",
        title: "Production Marketplace",
        body: "Browse casting agencies, crew teams, locations, equipment vendors, and catering partners in one storefront.",
        target: '[data-tour="marketplace-title"]',
        optional: true,
      },
      {
        id: "body",
        title: "Find partners",
        body: "Link your active project, open a category, then message vendors and request quotes without leaving Story Time.",
        target: '[data-tour="marketplace-body"]',
        optional: true,
      },
      {
        id: "nav",
        title: "Back to pipeline",
        body: "Return to Pre-Production tools from the sidebar when you are ready to continue planning.",
        target: '[data-tour="dashboard-sidebar-toggle"]',
      },
    ],
  },
  {
    id: "creator.wallet",
    version: 1,
    title: "Wallet & payouts",
    roles: CREATOR_ROLES,
    priority: 30,
    match: (p) => p === "/creator/wallet" || p.startsWith("/creator/wallet?"),
    startDelayMs: 400,
    steps: [
      {
        id: "title",
        title: "Wallet",
        body: "See available earnings, payout history, and banking status for creator revenue in ZAR.",
        target: '[data-tour="wallet-title"]',
        optional: true,
      },
      {
        id: "body",
        title: "Payouts",
        body: "Complete KYC and banking before requesting payouts. Available balances update after revenue clears.",
        target: '[data-tour="wallet-body"]',
        optional: true,
      },
    ],
  },
  {
    id: "creator.network",
    version: 1,
    title: "Network",
    roles: CREATOR_ROLES,
    priority: 25,
    match: (p) => p === "/creator/network" || p.startsWith("/creator/network?"),
    startDelayMs: 400,
    steps: [
      {
        id: "title",
        title: "Creator Network",
        body: "Discover collaborators, follow creators, and grow your professional presence on Story Time.",
        target: '[data-tour="network-title"]',
        optional: true,
      },
      {
        id: "body",
        title: "Connections",
        body: "Search profiles, send connection requests, and keep collaboration moving alongside your projects.",
        target: '[data-tour="network-body"]',
        optional: true,
      },
    ],
  },
  {
    id: "creator.messages",
    version: 1,
    title: "Messages",
    roles: CREATOR_ROLES,
    priority: 25,
    match: (p) => p === "/creator/messages" || p.startsWith("/creator/messages?"),
    startDelayMs: 400,
    steps: [
      {
        id: "title",
        title: "Messages",
        body: "Direct messages with collaborators and marketplace partners appear here.",
        target: '[data-tour="messages-title"]',
        optional: true,
      },
      {
        id: "body",
        title: "Inbox",
        body: "Open a thread to continue casting, crew, location, or deal conversations without leaving the creator portal.",
        target: '[data-tour="messages-body"]',
        optional: true,
      },
    ],
  },
  // Richer tool-specific tours (higher priority than generic tool tours)
  {
    id: "creator.tool.script-breakdown.rich",
    version: 1,
    title: "Script Breakdown Studio",
    roles: CREATOR_ROLES,
    priority: 25,
    match: matchProjectTool("script-breakdown"),
    startDelayMs: 600,
    steps: [
      {
        id: "header",
        title: "Script Breakdown Studio",
        body: "AI and manual tagging for cast, props, locations, wardrobe, and more — feeding scheduling, budgeting, casting, and call sheets.",
        target: '[data-tour="tool-workspace-header"]',
      },
      {
        id: "links",
        title: "Connected tools",
        body: "Jump to Script Writing, Budget Builder, Casting, or Scheduling when this breakdown is ready to drive the next step.",
        target: '[data-tour="tool-related-links"]',
        optional: true,
      },
      {
        id: "studio",
        title: "Studio tabs",
        body: "Use Command center, Scene dashboards, Screenplay, Catalog, Departments, Revisions, and the Breakdown editor to work through production elements.",
        target: '[data-tour="breakdown-studio-tabs"]',
        optional: true,
      },
      {
        id: "body",
        title: "Breakdown workspace",
        body: "Run AI populate, edit category rows, and save so casting and budget tools can reuse your tags.",
        target: '[data-tour="tool-workspace-body"]',
      },
    ],
  },
  {
    id: "creator.tool.budget-builder.rich",
    version: 1,
    title: "Budget Builder",
    roles: CREATOR_ROLES,
    priority: 25,
    match: matchProjectTool("budget-builder"),
    startDelayMs: 600,
    steps: [
      {
        id: "header",
        title: "Budget Builder",
        body: "Build planned costs by department, keep multiple budget versions, and compare against actual spend.",
        target: '[data-tour="tool-workspace-header"]',
      },
      {
        id: "links",
        title: "Connected tools",
        body: "Open Script Breakdown for tagged elements, Expense Tracker for actuals, and Production Scheduling for shoot-day context.",
        target: '[data-tour="tool-related-links"]',
        optional: true,
      },
      {
        id: "nav",
        title: "Budget sections",
        body: "Overview shows estimates and variance, Budget lines edits planned costs, Spending shows actuals, and Versions snapshots restore points.",
        target: '[data-tour="budget-studio-nav"]',
        optional: true,
      },
      {
        id: "body",
        title: "Budget work area",
        body: "Add lines manually or let the Virtual Assistant prefill from your script and breakdown. Set a VA default budget for Modoc actions.",
        target: '[data-tour="tool-workspace-body"]',
      },
    ],
  },
  ...ALL_PROJECT_TOOLS.filter(
    (t) => t.toolSlug !== "script-breakdown" && t.toolSlug !== "budget-builder",
  ).map(projectToolTour),
  // Fallback for any project tool path (kept low priority)
  {
    id: "creator.tool.generic",
    version: 1,
    title: "Project tool",
    roles: CREATOR_ROLES,
    priority: 5,
    match: matchAnyProjectTool,
    startDelayMs: 500,
    steps: [
      {
        id: "header",
        title: "Project tool workspace",
        body: "You are inside a project-scoped production tool. Work here saves to the active project and feeds later pipeline steps.",
        target: '[data-tour="tool-workspace-header"]',
      },
      {
        id: "body",
        title: "Controls",
        body: "Use the main work area to edit, generate, and review. Related tools are linked from the header when available.",
        target: '[data-tour="tool-workspace-body"]',
      },
    ],
  },
  ...stakeholderPortalHomes.map(stakeholderHomeTour),
  {
    id: "stakeholder.tasks",
    version: 1,
    title: "Action centre",
    roles: STAKEHOLDER_ROLES,
    priority: 35,
    match: (p) =>
      /^\/(funders|equipment-company|location-owner|crew-team|casting-agency|catering-company|music-creator)\/tasks\/?$/.test(
        p,
      ),
    startDelayMs: 400,
    steps: [
      {
        id: "title",
        title: "Action centre",
        body: "Prioritised tasks and follow-ups for your portal — approvals, replies, and deal steps that need attention.",
        target: '[data-tour="stakeholder-tasks"]',
        optional: true,
      },
      {
        id: "nav",
        title: "Workspace",
        body: "Calendar and Activity feed sit alongside Action centre so you can plan and review history in one portal.",
        target: '[data-tour="dashboard-sidebar-toggle"]',
      },
    ],
  },
  {
    id: "stakeholder.calendar",
    version: 1,
    title: "Calendar",
    roles: STAKEHOLDER_ROLES,
    priority: 30,
    match: (p) =>
      /^\/(funders|equipment-company|location-owner|crew-team|casting-agency|catering-company|music-creator)\/calendar\/?$/.test(
        p,
      ),
    startDelayMs: 400,
    steps: [
      {
        id: "title",
        title: "Portal calendar",
        body: "See upcoming bookings, shoots, and deadlines relevant to your role.",
        target: '[data-tour="stakeholder-calendar"]',
        optional: true,
      },
      {
        id: "nav",
        title: "Navigation",
        body: "Return to Home or Action centre from the sidebar whenever you need context beyond the calendar.",
        target: '[data-tour="dashboard-sidebar-toggle"]',
      },
    ],
  },
];

export function findMatchingTours(pathname: string, role: string | null | undefined): TourDefinition[] {
  const clean = pathname.split("?")[0] || pathname;
  return TOUR_REGISTRY.filter((tour) => {
    if (tour.roles.length > 0 && role && !tour.roles.includes(role as TourRole)) {
      // ADMIN acting as creator may still have CONTENT_CREATOR role via switch
      if (!(role === "ADMIN" && tour.roles.includes("CONTENT_CREATOR"))) return false;
    }
    if (tour.roles.length > 0 && !role) return false;
    try {
      return tour.match(clean);
    } catch {
      return false;
    }
  }).sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
}

export function getTourById(tourId: string): TourDefinition | undefined {
  return TOUR_REGISTRY.find((t) => t.id === tourId);
}

/** Exported for docs / admin — count of registered tours. */
export function listRegisteredTourIds(): string[] {
  return TOUR_REGISTRY.map((t) => t.id);
}
