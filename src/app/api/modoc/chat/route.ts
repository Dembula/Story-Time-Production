import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  buildModocSystemPrompt,
  MODOC_IDEA_DEVELOPMENT_INSTRUCTIONS,
  MODOC_SCRIPT_WRITING_INSTRUCTIONS,
  MODOC_TASK_LOGLINE,
  MODOC_TASK_IDEA_NOTES,
  MODOC_TASK_SCRIPT,
  MODOC_TASK_SCRIPT_REVIEW,
  MODOC_TASK_SCRIPT_BREAKDOWN,
  MODOC_TASK_BUDGET,
  MODOC_TASK_SCHEDULE,
  MODOC_TASK_LOCATION_MARKETPLACE,
  MODOC_TASK_EQUIPMENT_PLANNING,
  MODOC_TASK_CASTING_PORTAL,
  MODOC_TASK_CREW_MARKETPLACE,
  MODOC_TASK_VISUAL_PLANNING,
  MODOC_TASK_LEGAL_CONTRACTS,
  MODOC_TASK_FUNDING_HUB,
  MODOC_TASK_PITCH_DECK,
  MODOC_TASK_TABLE_READS,
  MODOC_TASK_PRODUCTION_WORKSPACE,
  MODOC_TASK_RISK_INSURANCE,
  MODOC_TASK_PRODUCTION_READINESS,
  MODOC_TASK_PRODUCTION_CONTROL_CENTER,
  MODOC_TASK_CALL_SHEET_GENERATOR,
  MODOC_TASK_ON_SET_TASKS,
  MODOC_TASK_EQUIPMENT_TRACKING,
  MODOC_TASK_SHOOT_PROGRESS,
  MODOC_TASK_CONTINUITY_MANAGER,
  MODOC_TASK_DAILIES_REVIEW,
  MODOC_TASK_PRODUCTION_EXPENSE_TRACKER,
  MODOC_TASK_INCIDENT_REPORTING,
  MODOC_TASK_PRODUCTION_WRAP,
  MODOC_TASK_CREATOR_ANALYTICS,
} from "@/lib/modoc";
import type { ModocUserContext } from "@/lib/modoc";
import { getCreatorAnalytics } from "@/lib/creator-analytics";
import { streamText, convertToCoreMessages, type UIMessage } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { prisma } from "@/lib/prisma";

/** OpenRouter: one API for 400+ models (OpenAI, Claude, Gemini, etc.). Uses OpenAI-compatible endpoint. */
const openRouter = createOpenAI({
  apiKey: process.env.OPENROUTER_API_KEY ?? "",
  baseURL: "https://openrouter.ai/api/v1",
  compatibility: "compatible",
});

/** Default MODOC model; override with OPENROUTER_MODOC_MODEL (e.g. anthropic/claude-3.5-sonnet, google/gemini-2.0-flash). */
const MODOC_MODEL = process.env.OPENROUTER_MODOC_MODEL ?? "openai/gpt-4o-mini";

export const maxDuration = 60;

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  const url = new URL(req.url);
  const path = url.pathname;

  let body: {
    messages?: UIMessage[];
    clientContext?: string;
    scope?: string;
    pageContext?: Record<string, string | number | boolean | null>;
    conversationId?: string;
  } = {};
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { messages: rawMessages = [], clientContext, scope, pageContext, conversationId } = body;
  const userId = (session?.user as { id?: string })?.id;

  // Persist the latest user message to the conversation when conversationId and auth are present
  if (conversationId && userId && Array.isArray(rawMessages) && rawMessages.length > 0) {
    const lastMessage = rawMessages[rawMessages.length - 1];
    const lastRole = typeof lastMessage === "object" && lastMessage && "role" in lastMessage ? (lastMessage as { role?: string }).role : undefined;
    const lastContent = typeof lastMessage === "object" && lastMessage && "content" in lastMessage
      ? (typeof (lastMessage as { content?: unknown }).content === "string"
          ? (lastMessage as { content: string }).content
          : Array.isArray((lastMessage as { content?: unknown[] }).content)
            ? (lastMessage as { content: Array<{ type?: string; text?: string }> }).content
                ?.find((p) => p.type === "text")
                ?.text ?? ""
            : "")
      : "";
    if (lastRole === "user" && lastContent) {
      try {
        const conv = await prisma.modocConversation.findFirst({
          where: { id: conversationId, userId },
        });
        if (conv) {
          await prisma.modocMessage.create({
            data: { conversationId, role: "user", content: lastContent },
          });
          await prisma.modocConversation.update({
            where: { id: conversationId },
            data: { updatedAt: new Date() },
          });
        }
      } catch (e) {
        if (process.env.NODE_ENV === "development") console.error("MODOC persist user message:", e);
      }
    }
  }

  if (!process.env.OPENROUTER_API_KEY) {
    return new Response(
      JSON.stringify({
        error:
          "MODOC is not configured. Set OPENROUTER_API_KEY in environment.",
      }),
      { status: 503, headers: { "Content-Type": "application/json" } }
    );
  }

  const userContext: ModocUserContext | null = session?.user
    ? {
        id: (session.user as { id?: string }).id ?? "",
        name: session.user.name ?? null,
        email: session.user.email ?? null,
        role: (session.user as { role?: string }).role ?? "SUBSCRIBER",
        scope: scope ?? path,
        pageContext: pageContext ?? undefined,
      }
    : null;

  let systemPrompt = buildModocSystemPrompt({
    platformSummary: "",
    user: userContext,
    path,
    clientContext,
  });

  // Viewer (browse) scope: inject published catalog + user watch history so MODOC can find movies/scenes and suggest from history
  if (scope === "browse" || path.startsWith("/browse")) {
    try {
      const [catalog, watchHistory] = await Promise.all([
        prisma.content.findMany({
          where: { published: true },
          select: { id: true, title: true, description: true, type: true, category: true, tags: true },
          orderBy: { createdAt: "desc" },
          take: 400,
        }),
        session?.user?.id
          ? prisma.watchSession.findMany({
              where: { userId: (session.user as { id?: string }).id },
              orderBy: { startedAt: "desc" },
              take: 50,
              include: { content: { select: { id: true, title: true, type: true, category: true } } },
            })
          : Promise.resolve([]),
      ]);
      const catalogBlob =
        catalog.length > 0
          ? catalog
              .map(
                (c) =>
                  `- id=${c.id} | title="${c.title}" | type=${c.type} | category=${c.category ?? ""} | tags=${c.tags ?? ""} | description=${(c.description ?? "").slice(0, 200)}`
              )
              .join("\n")
          : "(No published titles in catalog)";
      const historyBlob =
        watchHistory.length > 0
          ? watchHistory
              .map((w) => `${w.content.title} (${w.content.type}${w.content.category ? `, ${w.content.category}` : ""})`)
              .join("; ")
          : "(No watch history yet)";
      systemPrompt += `

## Viewer context (browse) — use this to answer

You have access to the **published Story Time catalog** and (if signed in) this viewer's **watch history**. Use it to:
1. **Scene/title search**: When the user describes a scene or asks "what movie is X from?", match against the catalog (title, description, tags, category) and suggest titles. We do not have per-scene data; infer from plot/description/tags. Always only suggest titles that appear in the catalog below. Include the content id so they can open /browse/content/[id].
2. **Suggestions**: Use their watch history to recommend similar titles from the catalog they haven't watched yet.

**Published catalog (only suggest from this list):**
${catalogBlob}

**This viewer's recent watch history:** ${historyBlob}

When suggesting a title, tell them they can open it at: /browse/content/[id] (replace [id] with the content id).`;
    } catch (e) {
      if (process.env.NODE_ENV === "development") console.error("MODOC viewer context fetch failed:", e);
    }
  }

  const toolScope = scope ?? (pageContext?.tool as string | undefined);
  const task = pageContext?.task as string | undefined;
  if (toolScope === "idea-development") {
    systemPrompt += MODOC_IDEA_DEVELOPMENT_INSTRUCTIONS;
  }
  if (toolScope === "script-writing") {
    systemPrompt += MODOC_SCRIPT_WRITING_INSTRUCTIONS;
  }
  if (task === "logline") systemPrompt += MODOC_TASK_LOGLINE;
  if (task === "idea_notes") systemPrompt += MODOC_TASK_IDEA_NOTES;
  if (task === "script") systemPrompt += MODOC_TASK_SCRIPT;
  if (task === "script_review") systemPrompt += MODOC_TASK_SCRIPT_REVIEW;
  if (task === "script_breakdown") systemPrompt += MODOC_TASK_SCRIPT_BREAKDOWN;
  if (task === "budget") systemPrompt += MODOC_TASK_BUDGET;
  if (task === "schedule") systemPrompt += MODOC_TASK_SCHEDULE;
  if (task === "location_marketplace") systemPrompt += MODOC_TASK_LOCATION_MARKETPLACE;
  if (task === "equipment_planning") systemPrompt += MODOC_TASK_EQUIPMENT_PLANNING;
  if (task === "casting_portal") systemPrompt += MODOC_TASK_CASTING_PORTAL;
  if (task === "crew_marketplace") systemPrompt += MODOC_TASK_CREW_MARKETPLACE;
  if (task === "visual_planning") systemPrompt += MODOC_TASK_VISUAL_PLANNING;
  if (task === "legal_contracts") systemPrompt += MODOC_TASK_LEGAL_CONTRACTS;
  if (task === "funding_hub") systemPrompt += MODOC_TASK_FUNDING_HUB;
  if (task === "pitch_deck") systemPrompt += MODOC_TASK_PITCH_DECK;
  if (task === "table_reads") systemPrompt += MODOC_TASK_TABLE_READS;
  if (task === "production_workspace") systemPrompt += MODOC_TASK_PRODUCTION_WORKSPACE;
  if (task === "risk_insurance") systemPrompt += MODOC_TASK_RISK_INSURANCE;
  if (task === "production_readiness") systemPrompt += MODOC_TASK_PRODUCTION_READINESS;
  if (task === "production_control_center") systemPrompt += MODOC_TASK_PRODUCTION_CONTROL_CENTER;
  if (task === "call_sheet_generator") systemPrompt += MODOC_TASK_CALL_SHEET_GENERATOR;
  if (task === "on_set_tasks") systemPrompt += MODOC_TASK_ON_SET_TASKS;
  if (task === "equipment_tracking") systemPrompt += MODOC_TASK_EQUIPMENT_TRACKING;
  if (task === "shoot_progress") systemPrompt += MODOC_TASK_SHOOT_PROGRESS;
  if (task === "continuity_manager") systemPrompt += MODOC_TASK_CONTINUITY_MANAGER;
  if (task === "dailies_review") systemPrompt += MODOC_TASK_DAILIES_REVIEW;
  if (task === "production_expense_tracker") systemPrompt += MODOC_TASK_PRODUCTION_EXPENSE_TRACKER;
  if (task === "incident_reporting") systemPrompt += MODOC_TASK_INCIDENT_REPORTING;
  if (task === "production_wrap") systemPrompt += MODOC_TASK_PRODUCTION_WRAP;
  if (task === "creator_analytics") systemPrompt += MODOC_TASK_CREATOR_ANALYTICS;

  const projectId = pageContext?.projectId as string | undefined;
  const userId = (session?.user as { id?: string })?.id;
  const role = (session?.user as { role?: string })?.role;

  // Context injection for marketplace/planning/planning tasks: project data + platform catalog or project-only context
  if (
    task === "location_marketplace" ||
    task === "equipment_planning" ||
    task === "casting_portal" ||
    task === "crew_marketplace" ||
    task === "visual_planning" ||
    task === "legal_contracts" ||
    task === "funding_hub" ||
    task === "pitch_deck" ||
    task === "table_reads" ||
    task === "production_workspace" ||
    task === "risk_insurance" ||
    task === "production_readiness" ||
    task === "production_control_center" ||
    task === "call_sheet_generator" ||
    task === "on_set_tasks" ||
    task === "equipment_tracking" ||
    task === "shoot_progress" ||
    task === "continuity_manager" ||
    task === "dailies_review" ||
    task === "production_expense_tracker" ||
    task === "incident_reporting" ||
    task === "production_wrap" ||
    task === "creator_analytics"
  ) {
    try {
      if (task === "creator_analytics" && userId && (role === "CONTENT_CREATOR" || role === "ADMIN")) {
        const analytics = await getCreatorAnalytics(userId);
        const rev = analytics.revenue;
        const eng = analytics.engagement;
        const contentBlob =
          analytics.contentPerformance.length > 0
            ? analytics.contentPerformance
                .map(
                  (c) =>
                    `- ${c.title} (${c.type}) | views: ${c.views} | watch time: ${Math.floor(c.watchTimeSeconds / 60)}m | comments: ${c.comments} | ratings: ${c.ratings} | watchlist: ${c.watchlistAdds} | avg rating: ${c.avgRating ?? "—"}`
                )
                .join("\n")
            : "(No content yet)";
        const projectsBlob =
          analytics.projects.total > 0
            ? `Total: ${analytics.projects.total}. By phase: ${JSON.stringify(analytics.projects.byPhase)}. By status: ${JSON.stringify(analytics.projects.byStatus)}`
            : "(No projects yet)";
        const compBlob = analytics.competition
          ? `Period: ${analytics.competition.periodName} | End: ${analytics.competition.endDate ?? "—"} | Creator rank: ${analytics.competition.rank ?? "—"} | Votes received: ${analytics.competition.voteCount}`
          : "(No active competition)";
        systemPrompt += `

## Creator analytics context — use this to answer

**Period:** ${analytics.period.start.slice(0, 10)} to ${analytics.period.end.slice(0, 10)}

**Revenue (this period):**
- Amount: R${rev.amount.toFixed(2)} | Watch time: ${Math.floor(rev.watchTimeSeconds / 3600)}h | Share of pool: ${rev.sharePercent}%
- Views: ${rev.totalViews} | Streams: ${rev.streamCount} | Per view: R${rev.perViewRand} | Per stream: R${rev.perStreamRand}
- Creator pool: R${rev.creatorPool.toFixed(2)} | Viewer sub revenue: R${rev.viewerSubRevenue.toFixed(2)}

**Engagement (all time):**
- Total views: ${eng.totalViews} | Unique watchers: ${eng.uniqueWatchers} | Content count: ${eng.contentCount}
- Avg watch time: ${Math.floor(eng.averageWatchTimeSeconds / 60)}m | Total watch time: ${Math.floor(eng.totalWatchTimeSeconds / 3600)}h
- Comments: ${eng.totalComments} | Ratings: ${eng.totalRatings} | Watchlist adds: ${eng.watchlistCount}

**Content performance (top titles):**
${contentBlob}

**Projects:**
${projectsBlob}

**Competition:**
${compBlob}

Summarize what these stats mean, how they connect, and suggest actionable next steps.`;
      }

      let project: { id: string; members: { userId: string }[]; pitches: { creatorId: string }[] } | null = null;
      if (projectId && userId && (role === "ADMIN" || role === "CONTENT_CREATOR")) {
        const p = await prisma.originalProject.findUnique({
          where: { id: projectId },
          select: { id: true, members: { select: { userId: true } }, pitches: { select: { creatorId: true } } },
        });
        if (p) {
          const isMember = role === "ADMIN" || p.members.some((m) => m.userId === userId) || p.pitches.some((pitch) => pitch.creatorId === userId);
          if (isMember) project = p;
        }
      }

      if (task === "location_marketplace") {
        const [breakdownLocs, listings] = await Promise.all([
          project
            ? prisma.breakdownLocation.findMany({
                where: { projectId: project.id },
                select: { id: true, name: true, description: true, locationListingId: true },
              })
            : [],
          prisma.locationListing.findMany({
            take: 200,
            orderBy: { createdAt: "desc" },
            select: { id: true, name: true, type: true, address: true, city: true, capacity: true, dailyRate: true, amenities: true, rules: true, availability: true },
          }),
        ]);
        const breakdownBlob =
          breakdownLocs.length > 0
            ? breakdownLocs.map((l) => `- id=${l.id} | name="${l.name}" | description=${(l.description ?? "").slice(0, 150)} | locationListingId=${l.locationListingId ?? "none"}`).join("\n")
            : "(No breakdown locations for this project)";
        const listBlob =
          listings.length > 0
            ? listings
                .map(
                  (l) =>
                    `- id=${l.id} | name="${l.name}" | type=${l.type} | city=${l.city ?? ""} | capacity=${l.capacity ?? "—"} | dailyRate=${l.dailyRate ?? "—"} | amenities=${(l.amenities ?? "").slice(0, 100)} | availability=${(l.availability ?? "").slice(0, 80)}`
                )
                .join("\n")
            : "(No location listings on platform)";
        systemPrompt += `

## Location marketplace context — use this to answer

**Project breakdown locations (script needs):**
${breakdownBlob}

**Available location listings (only suggest from this list):**
${listBlob}

Suggest matches and logistical notes (accessibility, suitability for filming). Cite listing id/name from the list above.`;
      }

      if (task === "equipment_planning") {
        const [planItems, listings] = await Promise.all([
          project
            ? prisma.equipmentPlanItem.findMany({
                where: { projectId: project.id },
                select: { id: true, department: true, category: true, quantity: true, notes: true, equipmentListingId: true },
              })
            : [],
          prisma.equipmentListing.findMany({
            take: 200,
            orderBy: { createdAt: "desc" },
            select: { id: true, companyName: true, category: true, description: true, location: true },
          }),
        ]);
        const planBlob =
          planItems.length > 0
            ? planItems.map((i) => `- id=${i.id} | category=${i.category} | department=${i.department ?? ""} | qty=${i.quantity} | notes=${(i.notes ?? "").slice(0, 80)} | equipmentListingId=${i.equipmentListingId ?? "none"}`).join("\n")
            : "(No equipment plan items for this project)";
        const listBlob =
          listings.length > 0
            ? listings.map((l) => `- id=${l.id} | company="${l.companyName}" | category=${l.category} | description=${(l.description ?? "").slice(0, 120)} | location=${l.location ?? ""}`).join("\n")
            : "(No equipment listings on platform)";
        systemPrompt += `

## Equipment planning context — use this to answer

**Project equipment plan:**
${planBlob}

**Available equipment listings (only suggest from this list):**
${listBlob}

Suggest categories and specific listings for optimal production quality. Cite listing id/name from the list above.`;
      }

      if (task === "casting_portal") {
        const [roles, agenciesWithTalent] = await Promise.all([
          project
            ? prisma.castingRole.findMany({
                where: { projectId: project.id },
                select: { id: true, name: true, description: true, status: true },
              })
            : [],
          prisma.castingAgency.findMany({
            take: 50,
            include: { talent: { orderBy: { sortOrder: "asc" }, take: 30, select: { id: true, name: true, bio: true, ageRange: true, ethnicity: true, gender: true, skills: true, pastWork: true } } },
          }),
        ]);
        const rolesBlob =
          roles.length > 0
            ? roles.map((r) => `- id=${r.id} | name="${r.name}" | description=${(r.description ?? "").slice(0, 150)} | status=${r.status}`).join("\n")
            : "(No casting roles for this project)";
        const talentBlob =
          agenciesWithTalent.length > 0
            ? agenciesWithTalent
                .flatMap((a) =>
                  a.talent.map((t) => `- id=${t.id} | name="${t.name}" | agency=${a.agencyName} | bio=${(t.bio ?? "").slice(0, 100)} | ageRange=${t.ageRange ?? ""} | skills=${t.skills ?? ""} | pastWork=${(t.pastWork ?? "").slice(0, 80)}`)
                )
                .slice(0, 300)
                .join("\n")
            : "(No talent on platform)";
        systemPrompt += `

## Casting portal context — use this to answer

**Project casting roles:**
${rolesBlob}

**Available talent (only suggest from this list):**
${talentBlob}

Suggest actor–role matches and optionally audition/communication tips. Cite talent id/name from the list above.`;
      }

      if (task === "crew_marketplace") {
        const [needs, teamsWithMembers] = await Promise.all([
          project
            ? prisma.crewRoleNeed.findMany({
                where: { projectId: project.id },
                select: { id: true, role: true, department: true, seniority: true, notes: true },
              })
            : [],
          prisma.crewTeam.findMany({
            take: 80,
            include: { members: { orderBy: { sortOrder: "asc" }, take: 20, select: { id: true, name: true, role: true, department: true, skills: true, pastWork: true } } },
          }),
        ]);
        const needsBlob =
          needs.length > 0
            ? needs.map((n) => `- id=${n.id} | role="${n.role}" | department=${n.department ?? ""} | seniority=${n.seniority ?? ""} | notes=${(n.notes ?? "").slice(0, 80)}`).join("\n")
            : "(No crew needs for this project)";
        const crewBlob =
          teamsWithMembers.length > 0
            ? teamsWithMembers
                .flatMap((t) =>
                  t.members.map((m) => `- memberId=${m.id} | name="${m.name}" | team=${t.companyName} | role=${m.role} | department=${m.department ?? ""} | skills=${(m.skills ?? "").slice(0, 80)} | pastWork=${(m.pastWork ?? "").slice(0, 60)}`)
                )
                .slice(0, 400)
                .join("\n")
            : "(No crew teams/members on platform)";
        systemPrompt += `

## Crew marketplace context — use this to answer

**Project crew needs:**
${needsBlob}

**Available crew (teams and members; only suggest from this list):**
${crewBlob}

Suggest which teams or members match which needs. Cite member/team id or name from the list above.`;
      }

      if (task === "visual_planning" && project) {
        const [scriptsWithVersions, breakdownLocations, breakdownCharacters, scenes] = await Promise.all([
          prisma.projectScript.findMany({
            where: { projectId: project.id },
            orderBy: { createdAt: "desc" },
            take: 3,
            include: { versions: { orderBy: { createdAt: "desc" }, take: 1, select: { content: true } } },
          }),
          prisma.breakdownLocation.findMany({
            where: { projectId: project.id },
            select: { name: true, description: true },
          }),
          prisma.breakdownCharacter.findMany({
            where: { projectId: project.id },
            select: { name: true, description: true, importance: true },
          }),
          prisma.projectScene.findMany({
            where: { projectId: project.id },
            orderBy: { number: "asc" },
            take: 50,
            select: { number: true, heading: true, summary: true },
          }),
        ]);
        const firstScriptContent = scriptsWithVersions[0]?.versions?.[0]?.content;
        const scriptExcerpt =
          firstScriptContent && firstScriptContent.length > 0
            ? firstScriptContent.slice(0, 6000)
            : "(No script content)";
        const scenesBlob =
          scenes.length > 0
            ? scenes.map((s) => `- Scene ${s.number}: ${s.heading ?? ""} ${s.summary ? `— ${(s.summary as string).slice(0, 120)}` : ""}`).join("\n")
            : "(No scenes)";
        const charsBlob =
          breakdownCharacters.length > 0
            ? breakdownCharacters.map((c) => `- ${c.name} (${c.importance ?? ""}): ${(c.description ?? "").slice(0, 80)}`).join("\n")
            : "(No characters)";
        const locsBlob =
          breakdownLocations.length > 0
            ? breakdownLocations.map((l) => `- ${l.name}: ${(l.description ?? "").slice(0, 80)}`).join("\n")
            : "(No locations)";
        systemPrompt += `

## Visual planning context — use this to answer

**Script excerpt (use for storyboards and shot suggestions):**
${scriptExcerpt}

**Scenes:**
${scenesBlob}

**Breakdown characters:**
${charsBlob}

**Breakdown locations:**
${locsBlob}

Suggest visual storyboards, shot compositions, and camera movements/angles based on the above. Be specific to each scene where possible.`;
      }

      if (task === "legal_contracts" && project) {
        const contractsWithVersions = await prisma.projectContract.findMany({
          where: { projectId: project.id },
          include: {
            versions: { orderBy: { version: "desc" }, take: 1, select: { terms: true, version: true } },
          },
        });
        const contractsBlob =
          contractsWithVersions.length > 0
            ? contractsWithVersions
                .map(
                  (c) =>
                    `--- Contract: ${c.type} | subject: ${c.subject ?? "—"} | status: ${c.status}\n${(c.versions[0]?.terms ?? "(No terms text yet)").slice(0, 3000)}`
                )
                .join("\n\n")
            : "(No contracts for this project)";
        systemPrompt += `

## Legal and contracts context — use this to answer

**Project contracts (type, subject, status) and current terms:**
${contractsBlob}

Analyze for compliance with industry standards; highlight important terms and potential issues. Frame as points to review with legal counsel.`;
      }

      if (task === "funding_hub" && project) {
        const [funding, budget, ideas] = await Promise.all([
          prisma.fundingRequest.findUnique({ where: { projectId: project.id } }),
          prisma.projectBudget.findUnique({
            where: { projectId: project.id },
            select: { template: true, totalPlanned: true },
          }),
          prisma.projectIdea.findMany({
            where: { projectId: project.id },
            take: 5,
            select: { title: true, logline: true, notes: true },
          }),
        ]);
        const ideaBlob =
          ideas.length > 0
            ? ideas.map((i) => `Title: ${i.title ?? "—"}\nLogline: ${(i.logline ?? "").slice(0, 300)}\nNotes: ${(i.notes ?? "").slice(0, 200)}`).join("\n\n")
            : "(No project ideas/logline yet)";
        const fundingBlob = funding
          ? `Option: ${funding.option} | Amount: ${funding.amount ?? "—"} ${funding.currency ?? ""} | Details: ${(funding.details ?? "").slice(0, 500)}`
          : "(No funding record yet)";
        const budgetBlob = budget
          ? `Template: ${budget.template} | Total planned: ${budget.totalPlanned ?? "—"}`
          : "(No budget yet)";
        systemPrompt += `

## Funding hub context — use this to answer

**Project idea / logline:**
${ideaBlob}

**Funding snapshot:**
${fundingBlob}

**Budget:**
${budgetBlob}

Suggest potential funding sources (by type/category), proposal structure, and how to tailor the ask. Do not invent specific fund names unless provided.`;
      }

      if (task === "pitch_deck" && project) {
        const [deck, ideas] = await Promise.all([
          prisma.pitchDeck.findUnique({
            where: { projectId: project.id },
            include: { slides: { orderBy: { sortOrder: "asc" } } },
          }),
          prisma.projectIdea.findMany({
            where: { projectId: project.id },
            take: 3,
            select: { title: true, logline: true, notes: true },
          }),
        ]);
        const ideaBlob =
          ideas.length > 0
            ? ideas.map((i) => `Title: ${i.title ?? "—"}\nLogline: ${(i.logline ?? "").slice(0, 400)}`).join("\n\n")
            : "(No project idea yet)";
        const slidesBlob =
          deck?.slides && deck.slides.length > 0
            ? deck.slides.map((s, i) => `Slide ${i + 1}: ${s.title ?? "Untitled"}\n${(s.body ?? "").slice(0, 300)}`).join("\n\n")
            : "(No pitch deck or slides yet)";
        systemPrompt += `

## Pitch deck context — use this to answer

**Project (title, logline):**
${ideaBlob}

**Current pitch deck slides:**
${slidesBlob}

Generate or refine slide content that highlights unique aspects and market potential. Output copy the creator can paste into their deck.`;
      }

      if (task === "table_reads" && project) {
        const [scriptsWithVersions, tableReadSessions, characters] = await Promise.all([
          prisma.projectScript.findMany({
            where: { projectId: project.id },
            orderBy: { createdAt: "desc" },
            take: 1,
            include: { versions: { orderBy: { createdAt: "desc" }, take: 1, select: { content: true } } },
          }),
          prisma.tableReadSession.findMany({
            where: { projectId: project.id },
            orderBy: { scheduledAt: "asc" },
            include: {
              participants: { include: { user: { select: { id: true, name: true, email: true } } } },
              notes: { include: { user: { select: { name: true } } }, orderBy: { createdAt: "asc" } },
            },
          }),
          prisma.breakdownCharacter.findMany({
            where: { projectId: project.id },
            select: { name: true, importance: true },
          }),
        ]);
        const scriptExcerpt =
          scriptsWithVersions[0]?.versions?.[0]?.content?.slice(0, 5000) ?? "(No script content)";
        const sessionsBlob =
          tableReadSessions.length > 0
            ? tableReadSessions
                .map(
                  (s) =>
                    `Session: ${s.name ?? "Unnamed"} | Scheduled: ${s.scheduledAt?.toISOString() ?? "—"}\nParticipants: ${s.participants.map((p) => `${p.user?.name ?? p.user?.email ?? "?"} (${p.characterName ?? "—"})`).join("; ")}\nNotes: ${s.notes.map((n) => `${n.body.slice(0, 150)} (${n.user?.name ?? "—"})`).join(" | ")}`
                )
                .join("\n\n")
            : "(No table read sessions yet)";
        const charsBlob =
          characters.length > 0
            ? characters.map((c) => `${c.name} (${c.importance ?? "—"})`).join(", ")
            : "(No breakdown characters)";
        systemPrompt += `

## Table reads context — use this to answer

**Script excerpt (for dialogue and pacing):**
${scriptExcerpt}

**Table read sessions (participants, notes):**
${sessionsBlob}

**Breakdown characters (for casting the read):**
${charsBlob}

Analyze dialogue and character interactions; suggest pacing improvements and how to schedule/coordinate participants and capture notes.`;
      }

      if (task === "production_workspace" && project) {
        const [tasks, shootDays, activitiesCount] = await Promise.all([
          prisma.projectTask.findMany({
            where: { projectId: project.id },
            orderBy: { createdAt: "desc" },
            take: 50,
            select: { id: true, title: true, status: true, department: true, description: true },
          }),
          prisma.shootDay.findMany({
            where: { projectId: project.id },
            orderBy: { date: "asc" },
            take: 30,
            select: { id: true, date: true, unit: true, callTime: true, wrapTime: true },
          }),
          prisma.projectActivity.count({ where: { projectId: project.id } }),
        ]);
        const tasksBlob =
          tasks.length > 0
            ? tasks.map((t) => `- ${t.title} | ${t.status} | ${t.department ?? "—"}`).join("\n")
            : "(No tasks yet)";
        const scheduleBlob =
          shootDays.length > 0
            ? shootDays.map((d) => `- ${d.date} | ${d.unit ?? "—"} | Call: ${d.callTime ?? "—"} | Wrap: ${d.wrapTime ?? "—"}`).join("\n")
            : "(No shoot days yet)";
        systemPrompt += `

## Production workspace context — use this to answer

**Project tasks:**
${tasksBlob}

**Shoot days (schedule):**
${scheduleBlob}

**Activity count:** ${activitiesCount}

Suggest how to manage documentation, schedules, and communications so the team stays aligned. Highlight gaps or areas needing attention.`;
      }

      if (task === "risk_insurance" && project) {
        const [riskPlan, breakdownStunts, breakdownVehicles] = await Promise.all([
          prisma.riskPlan.findUnique({
            where: { projectId: project.id },
            include: { items: true },
          }),
          prisma.breakdownStunt.findMany({
            where: { projectId: project.id },
            select: { description: true, safetyNotes: true },
          }),
          prisma.breakdownVehicle.findMany({
            where: { projectId: project.id },
            select: { description: true },
          }),
        ]);
        const riskBlob =
          riskPlan?.items && riskPlan.items.length > 0
            ? riskPlan.items.map((i) => `- ${i.category}: ${i.description} (${i.status})`).join("\n")
            : "(No risk checklist items yet)";
        const stuntsBlob =
          breakdownStunts.length > 0
            ? breakdownStunts.map((s) => `- ${s.description}${s.safetyNotes ? ` | Safety: ${(s.safetyNotes ?? "").slice(0, 100)}` : ""}`).join("\n")
            : "(No stunts in breakdown)";
        const vehiclesBlob =
          breakdownVehicles.length > 0
            ? breakdownVehicles.map((v) => `- ${v.description}`).join("\n")
            : "(No vehicles in breakdown)";
        systemPrompt += `

## Risk and insurance context — use this to answer

**Risk checklist:**
${riskBlob}

**Breakdown stunts:**
${stuntsBlob}

**Breakdown vehicles:**
${vehiclesBlob}

Assess risks and suggest insurance coverage and contingency plans. Frame as points to discuss with broker or counsel.`;
      }

      if (task === "production_readiness" && project) {
        const [budget, castRoles, crewNeeds, locations, equipmentPlan, riskPlan, contracts] =
          await Promise.all([
            prisma.projectBudget.findUnique({ where: { projectId: project.id } }),
            prisma.castingRole.count({ where: { projectId: project.id } }),
            prisma.crewRoleNeed.count({ where: { projectId: project.id } }),
            prisma.breakdownLocation.count({ where: { projectId: project.id } }),
            prisma.equipmentPlanItem.count({ where: { projectId: project.id } }),
            prisma.riskPlan.findUnique({ where: { projectId: project.id } }),
            prisma.projectContract.count({ where: { projectId: project.id } }),
          ]);
        const checklist = {
          hasBudget: !!budget,
          hasCast: castRoles > 0,
          hasCrew: crewNeeds > 0,
          hasLocations: locations > 0,
          hasEquipmentPlan: (equipmentPlan ?? 0) > 0,
          hasRiskPlan: !!riskPlan,
          hasContracts: (contracts ?? 0) > 0,
        };
        const completedCount = Object.values(checklist).filter(Boolean).length;
        const percent = Math.round((completedCount / Object.keys(checklist).length) * 100);
        const checklistBlob = Object.entries(checklist)
          .map(([k, v]) => `- ${k}: ${v ? "Yes" : "No"}`)
          .join("\n");
        systemPrompt += `

## Production readiness context — use this to answer

**Readiness checklist:** ${percent}% complete
${checklistBlob}

**Counts:** Cast roles: ${castRoles} | Crew needs: ${crewNeeds} | Locations: ${locations} | Equipment items: ${equipmentPlan ?? 0} | Contracts: ${contracts ?? 0}

Assess readiness, highlight areas needing attention, and suggest priorities before shooting.`;
      }

      if (task === "production_control_center" && project) {
        const [shootDays, tasks, incidents, riskPlan] = await Promise.all([
          prisma.shootDay.findMany({
            where: { projectId: project.id },
            orderBy: { date: "asc" },
            take: 30,
            include: { scenes: { include: { scene: { select: { number: true, heading: true } } }, orderBy: { order: "asc" } } },
          }),
          prisma.projectTask.findMany({
            where: { projectId: project.id },
            orderBy: { createdAt: "desc" },
            take: 80,
            select: { id: true, title: true, status: true, priority: true, department: true },
          }),
          prisma.incidentReport.findMany({
            where: { projectId: project.id },
            orderBy: { createdAt: "desc" },
            take: 30,
            select: { id: true, title: true, severity: true, resolved: true, createdAt: true },
          }),
          prisma.riskPlan.findUnique({
            where: { projectId: project.id },
            include: { items: { select: { category: true, status: true } } },
          }),
        ]);
        const today = new Date().toISOString().slice(0, 10);
        const todayDay = shootDays.find((d) => d.date.toISOString().startsWith(today));
        const scheduleBlob =
          shootDays.length > 0
            ? shootDays
                .map(
                  (d) =>
                    `- ${d.date.toISOString().slice(0, 10)} | ${d.unit ?? "—"} | Call: ${d.callTime ?? "—"} | Wrap: ${d.wrapTime ?? "—"} | ${d.status} | Loc: ${d.locationSummary ?? "—"} | Scenes: ${d.scenes.map((s) => s.scene?.number).filter(Boolean).join(", ")}`
                )
                .join("\n")
            : "(No shoot days yet)";
        const tasksBlob =
          tasks.length > 0
            ? tasks.map((t) => `- ${t.title} | ${t.status} | ${t.priority ?? "—"} | ${t.department ?? "—"}`).join("\n")
            : "(No tasks yet)";
        const incidentsBlob =
          incidents.length > 0
            ? incidents.map((i) => `- ${i.title} | ${i.severity} | resolved: ${i.resolved}`).join("\n")
            : "(No incidents)";
        const riskBlob =
          riskPlan?.items && riskPlan.items.length > 0
            ? riskPlan.items.map((i) => `- ${i.category}: ${i.status}`).join("\n")
            : "(No risk items)";
        systemPrompt += `

## Production control center context — use this to answer

**Today's shoot (if any):** ${todayDay ? `${todayDay.date.toISOString().slice(0, 10)} | Call: ${todayDay.callTime ?? "—"} | Wrap: ${todayDay.wrapTime ?? "—"} | ${todayDay.locationSummary ?? "—"} | Scenes: ${todayDay.scenes.map((s) => s.scene?.number).filter(Boolean).join(", ")}` : "No shoot scheduled for today."}

**Schedule (shoot days):**
${scheduleBlob}

**Tasks:**
${tasksBlob}

**Incidents:**
${incidentsBlob}

**Risk items:**
${riskBlob}

Provide workflow insights, progress summary, and communication suggestions so the team stays on course.`;
      }

      if (task === "call_sheet_generator" && project) {
        const [shootDays, callSheets] = await Promise.all([
          prisma.shootDay.findMany({
            where: { projectId: project.id },
            orderBy: { date: "asc" },
            include: { scenes: { include: { scene: { select: { number: true, heading: true } } }, orderBy: { order: "asc" } } },
          }),
          prisma.callSheet.findMany({
            where: { projectId: project.id },
            orderBy: { createdAt: "desc" },
            take: 20,
            include: { shootDay: { select: { date: true } } },
          }),
        ]);
        const scheduleBlob =
          shootDays.length > 0
            ? shootDays
                .map(
                  (d) =>
                    `- Day ${d.date.toISOString().slice(0, 10)} | Unit: ${d.unit ?? "—"} | Call: ${d.callTime ?? "—"} | Wrap: ${d.wrapTime ?? "—"} | Location: ${d.locationSummary ?? "—"} | Scenes: ${d.scenes.map((s) => s.scene?.number).filter(Boolean).join(", ")}`
                )
                .join("\n")
            : "(No shoot days in schedule)";
        const sheetsBlob =
          callSheets.length > 0
            ? callSheets.map((c) => `- ${c.title ?? "Call sheet"} | Day: ${c.shootDay?.date?.toISOString().slice(0, 10) ?? "—"} | Notes: ${(c.notes ?? "").slice(0, 150)}`).join("\n")
            : "(No call sheets generated yet)";
        systemPrompt += `

## Call sheet generator context — use this to answer

**Production schedule (shoot days with scenes, call/wrap, locations):**
${scheduleBlob}

**Existing call sheets:**
${sheetsBlob}

Suggest what to include on each call sheet and how to automate generation from this schedule.`;
      }

      if (task === "on_set_tasks" && project) {
        const [tasks, shootDays] = await Promise.all([
          prisma.projectTask.findMany({
            where: { projectId: project.id },
            orderBy: { createdAt: "desc" },
            take: 100,
            select: { id: true, title: true, status: true, department: true, priority: true, description: true },
          }),
          prisma.shootDay.findMany({
            where: { projectId: project.id },
            orderBy: { date: "asc" },
            take: 30,
            select: { id: true, date: true, callTime: true, wrapTime: true, status: true },
          }),
        ]);
        const todo = tasks.filter((t) => t.status === "TODO");
        const inProgress = tasks.filter((t) => t.status === "IN_PROGRESS");
        const done = tasks.filter((t) => t.status === "DONE");
        const tasksBlob =
          tasks.length > 0
            ? tasks.map((t) => `- ${t.title} | ${t.status} | ${t.department ?? "—"} | ${t.priority ?? "—"}`).join("\n")
            : "(No tasks yet)";
        const scheduleBlob =
          shootDays.length > 0
            ? shootDays.map((d) => `- ${d.date.toISOString().slice(0, 10)} | Call: ${d.callTime ?? "—"} | Wrap: ${d.wrapTime ?? "—"} | ${d.status}`).join("\n")
            : "(No shoot days)";
        systemPrompt += `

## On-set task management context — use this to answer

**Tasks (To do: ${todo.length}, In progress: ${inProgress.length}, Done: ${done.length}):**
${tasksBlob}

**Shoot schedule (for tying tasks to days/call times):**
${scheduleBlob}

Suggest priorities, reminders, and how to handle real-time schedule or requirement changes.`;
      }

      if (task === "equipment_tracking" && project) {
        const [equipmentItems, shootDays] = await Promise.all([
          prisma.equipmentPlanItem.findMany({
            where: { projectId: project.id },
            select: { id: true, category: true, quantity: true, department: true, description: true, notes: true },
          }),
          prisma.shootDay.findMany({
            where: { projectId: project.id },
            orderBy: { date: "asc" },
            take: 14,
            select: { date: true, status: true },
          }),
        ]);
        const byDept = equipmentItems.reduce(
          (acc, i) => {
            const key = i.department ?? "Other";
            if (!acc[key]) acc[key] = [];
            acc[key].push(i);
            return acc;
          },
          {} as Record<string, typeof equipmentItems>
        );
        const itemsBlob =
          equipmentItems.length > 0
            ? Object.entries(byDept)
                  .map(
                    ([dept, list]) =>
                      `Department ${dept}: ${list.map((i) => `${i.category} x${i.quantity}${i.description ? ` (${i.description.slice(0, 60)})` : ""}`).join("; ")}`
                  )
                  .join("\n")
            : "(No equipment planned yet)";
        const scheduleBlob =
          shootDays.length > 0
            ? shootDays.map((d) => `- ${d.date.toISOString().slice(0, 10)} | ${d.status}`).join("\n")
            : "(No shoot days)";
        systemPrompt += `

## Equipment tracking context — use this to answer

**Planned equipment (by department):**
${itemsBlob}

**Upcoming shoot days:**
${scheduleBlob}

Suggest usage and availability tracking, maintenance and accountability practices, and any gaps for upcoming days.`;
      }

      if (task === "shoot_progress" && project) {
        const [shootDays, scenes] = await Promise.all([
          prisma.shootDay.findMany({
            where: { projectId: project.id },
            orderBy: { date: "asc" },
            include: { scenes: { include: { scene: { select: { number: true, heading: true, status: true } } }, orderBy: { order: "asc" } } },
          }),
          prisma.projectScene.findMany({
            where: { projectId: project.id },
            select: { id: true, number: true, heading: true, status: true },
          }),
        ]);
        const completed = shootDays.filter((d) => d.status === "WRAPPED" || d.status === "COMPLETED").length;
        const scheduleBlob =
          shootDays.length > 0
            ? shootDays
                .map(
                  (d) =>
                    `- ${d.date.toISOString().slice(0, 10)} | ${d.status} | Scenes: ${d.scenes.map((s) => s.scene?.number).filter(Boolean).join(", ")}`
                )
                .join("\n")
            : "(No shoot days)";
        const scenesBlob =
          scenes.length > 0
            ? scenes.map((s) => `- Scene ${s.number} | ${s.heading ?? "—"} | ${s.status}`).join("\n")
            : "(No scenes)";
        systemPrompt += `

## Shoot progress context — use this to answer

**Shoot days (${completed} completed / ${shootDays.length} total):**
${scheduleBlob}

**Scenes:**
${scenesBlob}

Monitor progress vs schedule; suggest adjustments for delays and how to stay on track.`;
      }

      if (task === "continuity_manager" && project) {
        const [continuityNotes, props, wardrobes, locations] = await Promise.all([
          prisma.continuityNote.findMany({
            where: { projectId: project.id },
            orderBy: { createdAt: "desc" },
            take: 100,
            include: { scene: { select: { number: true } }, shootDay: { select: { date: true } } },
          }),
          prisma.breakdownProp.findMany({
            where: { projectId: project.id },
            take: 50,
            select: { name: true, description: true, scene: { select: { number: true } } },
          }),
          prisma.breakdownWardrobe.findMany({
            where: { projectId: project.id },
            take: 50,
            select: { description: true, character: true, scene: { select: { number: true } } },
          }),
          prisma.breakdownLocation.findMany({
            where: { projectId: project.id },
            take: 30,
            select: { name: true, description: true, scene: { select: { number: true } } },
          }),
        ]);
        const notesBlob =
          continuityNotes.length > 0
            ? continuityNotes
                .map((n) => `- ${n.body.slice(0, 200)} | Scene: ${n.scene?.number ?? "—"} | Day: ${n.shootDay?.date?.toISOString().slice(0, 10) ?? "—"}`)
                .join("\n")
            : "(No continuity notes yet)";
        const propsBlob = props.length > 0 ? props.map((p) => `- ${p.name} | Scene ${p.scene?.number ?? "—"} | ${(p.description ?? "").slice(0, 80)}`).join("\n") : "(No props in breakdown)";
        const wardrobesBlob = wardrobes.length > 0 ? wardrobes.map((w) => `- ${(w.character ?? w.description ?? "—").slice(0, 60)} | Scene ${w.scene?.number ?? "—"}`).join("\n") : "(No wardrobes in breakdown)";
        const locsBlob = locations.length > 0 ? locations.map((l) => `- ${l.name} | Scene ${l.scene?.number ?? "—"}`).join("\n") : "(No locations in breakdown)";
        systemPrompt += `

## Continuity manager context — use this to answer

**Continuity notes:**
${notesBlob}

**Breakdown props:**
${propsBlob}

**Breakdown wardrobes:**
${wardrobesBlob}

**Breakdown locations:**
${locsBlob}

Suggest how to track costumes, props, and locations for consistency; recommend checklists and organization.`;
      }

      if (task === "dailies_review" && project) {
        const batches = await prisma.dailiesBatch.findMany({
          where: { projectId: project.id },
          orderBy: { createdAt: "desc" },
          take: 50,
          include: {
            scene: { select: { number: true } },
            shootDay: { select: { date: true } },
            reviewNotes: { select: { body: true }, orderBy: { createdAt: "asc" } },
          },
        });
        const batchesBlob =
          batches.length > 0
            ? batches
                .map(
                  (b) =>
                    `- ${b.title ?? "Untitled"} | Scene: ${b.scene?.number ?? "—"} | Day: ${b.shootDay?.date?.toISOString().slice(0, 10) ?? "—"} | Notes: ${(b.notes ?? "").slice(0, 150)} | Review: ${b.reviewNotes.map((r) => r.body.slice(0, 80)).join("; ")}`
                )
                .join("\n")
            : "(No dailies batches yet)";
        systemPrompt += `

## Dailies review context — use this to answer

**Dailies batches (scene, day, notes, review notes):**
${batchesBlob}

Analyze for quality and consistency; suggest what to flag before post-production. You do not see video—use titles and notes only.`;
      }

      if (task === "production_expense_tracker" && project) {
        const [expenses, budget] = await Promise.all([
          prisma.productionExpense.findMany({
            where: { projectId: project.id },
            orderBy: { spentAt: "desc" },
            take: 150,
            select: { id: true, description: true, amount: true, department: true, spentAt: true, vendor: true },
          }),
          prisma.projectBudget.findUnique({
            where: { projectId: project.id },
            select: { totalPlanned: true },
          }),
        ]);
        const totalSpent = expenses.reduce((s, e) => s + e.amount, 0);
        const planned = budget?.totalPlanned ?? 0;
        const byDept = expenses.reduce(
          (acc, e) => {
            const key = e.department ?? "Other";
            if (!acc[key]) acc[key] = { total: 0, count: 0 };
            acc[key].total += e.amount;
            acc[key].count += 1;
            return acc;
          },
          {} as Record<string, { total: number; count: number }>
        );
        const expensesBlob =
          expenses.length > 0
            ? expenses.map((e) => `- ${e.description ?? e.department ?? "Expense"} | R${e.amount.toFixed(2)} | ${e.department ?? "—"} | ${e.spentAt.toISOString().slice(0, 10)}`).join("\n")
            : "(No expenses logged yet)";
        const deptBlob =
          Object.keys(byDept).length > 0
            ? Object.entries(byDept)
                .map(([dept, v]) => `- ${dept}: R${v.total.toFixed(2)} (${v.count} items)`)
                .join("\n")
            : "";
        systemPrompt += `

## Production expense tracker context — use this to answer

**Planned budget total:** R${planned.toFixed(2)}
**Total spent:** R${totalSpent.toFixed(2)}${planned > 0 ? ` (${Math.round((totalSpent / planned) * 100)}% of budget)` : ""}

**Expenses:**
${expensesBlob}
${deptBlob ? `\n**By department:**\n${deptBlob}` : ""}

Suggest categorization, budget adherence insights, and practices to stay on budget.`;
      }

      if (task === "incident_reporting" && project) {
        const [incidents, shootDays] = await Promise.all([
          prisma.incidentReport.findMany({
            where: { projectId: project.id },
            orderBy: { createdAt: "desc" },
            include: { shootDay: { select: { date: true } } },
          }),
          prisma.shootDay.findMany({
            where: { projectId: project.id },
            orderBy: { date: "asc" },
            select: { date: true, status: true },
          }),
        ]);
        const incidentsBlob =
          incidents.length > 0
            ? incidents.map((i) => `- ${i.title} | ${i.severity} | resolved: ${i.resolved} | Day: ${i.shootDay?.date?.toISOString().slice(0, 10) ?? "—"} | ${i.description.slice(0, 150)}`).join("\n")
            : "(No incidents reported yet)";
        const scheduleBlob =
          shootDays.length > 0
            ? shootDays.map((d) => `- ${d.date.toISOString().slice(0, 10)} | ${d.status}`).join("\n")
            : "(No shoot days)";
        systemPrompt += `

## Incident reporting context — use this to answer

**Incidents:**
${incidentsBlob}

**Schedule (for impact context):**
${scheduleBlob}

Suggest report templates, impact on schedule/budget, and patterns or escalation.`;
      }

      if (task === "production_wrap" && project) {
        const [shootDays, incidents, tasks, continuityCount, dailiesCount, equipmentCount] = await Promise.all([
          prisma.shootDay.findMany({
            where: { projectId: project.id },
            orderBy: { date: "asc" },
            select: { id: true, date: true, status: true },
          }),
          prisma.incidentReport.findMany({
            where: { projectId: project.id },
            select: { id: true, title: true, resolved: true, severity: true },
          }),
          prisma.projectTask.findMany({
            where: { projectId: project.id },
            select: { id: true, title: true, status: true },
          }),
          prisma.continuityNote.count({ where: { projectId: project.id } }),
          prisma.dailiesBatch.count({ where: { projectId: project.id } }),
          prisma.equipmentPlanItem.count({ where: { projectId: project.id } }),
        ]);
        const completedDays = shootDays.filter((d) => d.status === "WRAPPED" || d.status === "COMPLETED").length;
        const openIncidents = incidents.filter((i) => !i.resolved).length;
        const openTasks = tasks.filter((t) => t.status !== "DONE").length;
        const scheduleBlob = shootDays.length > 0 ? shootDays.map((d) => `- ${d.date.toISOString().slice(0, 10)} | ${d.status}`).join("\n") : "(No shoot days)";
        const incidentsBlob =
          incidents.length > 0
            ? incidents.map((i) => `- ${i.title} | ${i.severity} | resolved: ${i.resolved}`).join("\n")
            : "(No incidents)";
        const tasksBlob = tasks.length > 0 ? tasks.filter((t) => t.status !== "DONE").map((t) => `- ${t.title} | ${t.status}`).join("\n") : "(No open tasks)";
        systemPrompt += `

## Production wrap context — use this to answer

**Shoot days:** ${completedDays} / ${shootDays.length} completed
${scheduleBlob}

**Incidents:** ${openIncidents} open of ${incidents.length} total
${incidentsBlob}

**Open tasks:** ${openTasks}
${tasksBlob}

**Counts:** Continuity notes: ${continuityCount} | Dailies batches: ${dailiesCount} | Equipment plan items: ${equipmentCount}

Suggest performance summary, lessons learned categories, and a final deliverables checklist before moving to post.`;
      }
    } catch (e) {
      if (process.env.NODE_ENV === "development") console.error("MODOC marketplace context fetch failed:", e);
    }
  }

  const messages =
    Array.isArray(rawMessages) && rawMessages.length > 0
      ? convertToCoreMessages(
          rawMessages as Parameters<typeof convertToCoreMessages>[0]
        )
      : [];

  const result = streamText({
    model: openRouter(MODOC_MODEL),
    system: systemPrompt,
    messages,
    maxTokens: 4096,
    temperature: 0.7,
  });

  return result.toDataStreamResponse();
}
