import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { notifyUser } from "@/lib/notify-user";
import { buildAppUrl } from "@/lib/app-url";
import { validateStorageUrlField } from "@/lib/storage-origin";

const REVIEW_REASON_CODES = [
  "STORY_CLARITY",
  "CHARACTER_DEPTH",
  "MARKET_POSITIONING",
  "AUDIENCE_FIT",
  "BUDGET_REALISM",
  "PRODUCTION_FEASIBILITY",
  "TEAM_EXPERIENCE",
  "PACKAGE_INCOMPLETE",
  "LEGAL_RIGHTS_UNCLEAR",
  "BRAND_SAFETY_CONCERNS",
] as const;

type ReviewRubricInput = {
  story: number;
  marketability: number;
  feasibility: number;
  teamReadiness: number;
};

function parseRubric(raw: unknown): ReviewRubricInput | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;
  const rubric: ReviewRubricInput = {
    story: Number(obj.story),
    marketability: Number(obj.marketability),
    feasibility: Number(obj.feasibility),
    teamReadiness: Number(obj.teamReadiness),
  };
  const values = Object.values(rubric);
  if (values.some((v) => !Number.isFinite(v) || v < 0 || v > 10)) return null;
  return rubric;
}

function computeWeightedScore(rubric: ReviewRubricInput): number {
  const score =
    rubric.story * 0.4 +
    rubric.marketability * 0.25 +
    rubric.feasibility * 0.2 +
    rubric.teamReadiness * 0.15;
  return Math.round(score * 10 * 10) / 10;
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = (session.user as { role?: string }).role;
  const userId = session.user.id;
  const type = req.nextUrl.searchParams.get("type");

  if (type === "projects") {
    const projects = await prisma.originalProject.findMany({
      include: {
        members: {
          include: {
            user: { select: { id: true, name: true, email: true, role: true } },
          },
        },
        pitches: {
          select: { id: true, title: true, status: true, creator: { select: { name: true } } },
        },
        toolProgress: {
          select: { id: true, toolId: true, phase: true, status: true, percent: true },
        },
        _count: { select: { members: true, pitches: true } },
      },
      orderBy: { updatedAt: "desc" },
    });
    return NextResponse.json(projects);
  }

  if (type === "pitches") {
    const where = role === "ADMIN" ? {} : { creatorId: userId };
    const pitches = await prisma.originalPitch.findMany({
      where,
      include: {
        creator: { select: { id: true, name: true, email: true } },
        project: { select: { id: true, title: true } },
      },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(pitches);
  }

  // Standalone movie ideas submitted by creators that have not yet been converted
  // into an Originals project. This powers the admin collaboration portal.
  if (type === "standalone-ideas") {
    const ideas = await prisma.projectIdea.findMany({
      where: {
        projectId: null,
        convertedToProject: false,
        userId: { not: null },
      },
      include: {
        user: {
          select: { id: true, name: true, email: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(ideas);
  }

  if (type === "my-projects") {
    const memberships = await prisma.originalMember.findMany({
      where: { userId },
      include: {
        project: {
          include: {
            members: { include: { user: { select: { id: true, name: true, role: true } } } },
            _count: { select: { members: true } },
          },
        },
      },
    });
    return NextResponse.json(memberships);
  }

  // Projects the creator is a member of that have a script (legacy; prefer my-scripts)
  if (type === "projects-with-scripts") {
    const memberships = await prisma.originalMember.findMany({
      where: { userId, status: "ACTIVE" },
      include: { project: { include: { _count: { select: { pitches: true } } } } },
    });
    const projectIds = memberships.map((m) => m.project.id);
    const scripts = await prisma.projectScript.findMany({
      where: { projectId: { in: projectIds } },
      select: { projectId: true },
    });
    const withScriptIds = new Set(scripts.map((s) => s.projectId));
    const list = memberships
      .filter((m) => withScriptIds.has(m.project.id))
      .map((m) => ({ id: m.project.id, title: m.project.title }));
    return NextResponse.json(list);
  }

  // List of saved scripts from Pre-Production Script Writing (projects user is ACTIVE member of)
  if (type === "my-scripts") {
    const memberships = await prisma.originalMember.findMany({
      where: { userId, status: "ACTIVE" },
      select: { projectId: true, project: { select: { id: true, title: true } } },
    });
    const projectIds = memberships.map((m) => m.project.id);
    const scripts = await prisma.projectScript.findMany({
      where: { projectId: { in: projectIds } },
      select: { id: true, title: true, projectId: true },
    });
    const projectMap = Object.fromEntries(memberships.map((m) => [m.project.id, m.project.title]));
    const list = scripts.map((s) => ({
      id: s.id,
      title: s.title,
      projectId: s.projectId,
      projectTitle: projectMap[s.projectId] ?? "Project",
    }));
    return NextResponse.json(list);
  }

  return NextResponse.json({ error: "Specify type param" }, { status: 400 });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = (session.user as { role?: string }).role;
  const body = await req.json();
  const { action } = body;

  if (action === "CREATE_PROJECT" && role === "ADMIN") {
    const { title, logline, synopsis, type, genre, budget, targetDate, posterUrl } = body;
    const posterErr = validateStorageUrlField(posterUrl, "posterUrl");
    if (posterErr) return NextResponse.json({ error: posterErr }, { status: 400 });
    const project = await prisma.originalProject.create({
      data: { title, logline, synopsis, type, genre, budget: budget ? Number(budget) : null, targetDate, posterUrl },
    });
    return NextResponse.json(project);
  }

  if (action === "SUBMIT_PITCH") {
    const {
      title, logline, synopsis, type, genre,
      scriptUrl, scriptProjectId, scriptId, treatmentUrl, lookbookUrl,
      budgetEst, targetAudience, references,
      directorStatement, productionCompany, previousWorkSummary,
      intendedRelease, keyCastCrew, financingStatus, pitchId,
    } = body;
    const requiredTextFields = [
      { key: "title", value: title, label: "Title" },
      { key: "logline", value: logline, label: "Logline" },
      { key: "synopsis", value: synopsis, label: "Synopsis" },
      { key: "genre", value: genre, label: "Genre" },
      { key: "targetAudience", value: targetAudience, label: "Target audience" },
      { key: "references", value: references, label: "References" },
      { key: "directorStatement", value: directorStatement, label: "Director statement" },
      { key: "productionCompany", value: productionCompany, label: "Production company" },
      { key: "previousWorkSummary", value: previousWorkSummary, label: "Previous work summary" },
      { key: "intendedRelease", value: intendedRelease, label: "Intended release" },
      { key: "keyCastCrew", value: keyCastCrew, label: "Key cast / crew" },
      { key: "financingStatus", value: financingStatus, label: "Financing status" },
    ];
    const missingRequired = requiredTextFields.filter((field) => !field.value?.trim());
    if (missingRequired.length > 0) {
      return NextResponse.json(
        { error: `Missing required fields: ${missingRequired.map((f) => f.label).join(", ")}` },
        { status: 400 },
      );
    }
    const parsedBudget = Number(budgetEst);
    if (!Number.isFinite(parsedBudget) || parsedBudget <= 0) {
      return NextResponse.json({ error: "Estimated budget must be a number greater than 0." }, { status: 400 });
    }
    for (const [field, value] of [
      ["scriptUrl", scriptUrl],
      ["treatmentUrl", treatmentUrl],
      ["lookbookUrl", lookbookUrl],
    ] as const) {
      const error = validateStorageUrlField(value, field);
      if (error) return NextResponse.json({ error }, { status: 400 });
    }
    const hasScript = scriptUrl?.trim() || scriptProjectId?.trim() || scriptId?.trim();
    if (!hasScript) {
      return NextResponse.json({ error: "Script is required: choose from your saved scripts, upload a PDF, or provide a link" }, { status: 400 });
    }
    let resolvedScriptProjectId: string | null = scriptProjectId?.trim() || null;
    if (scriptId?.trim()) {
      const script = await prisma.projectScript.findFirst({
        where: { id: scriptId.trim() },
        select: { projectId: true },
      });
      if (script) resolvedScriptProjectId = script.projectId;
    }
    const timelineEntry = {
      type: "SUBMITTED",
      at: new Date().toISOString(),
      note: "Submission created",
    } satisfies Prisma.InputJsonValue;

    const currentData = {
      title: title.trim(),
      logline: logline.trim(),
      synopsis: synopsis?.trim() || null,
      type: type || "Film",
      genre: genre?.trim() || null,
      scriptUrl: scriptUrl?.trim() || null,
      scriptProjectId: resolvedScriptProjectId,
      scriptId: scriptId?.trim() || null,
      treatmentUrl: treatmentUrl?.trim() || null,
      lookbookUrl: lookbookUrl?.trim() || null,
      budgetEst: parsedBudget,
      targetAudience: targetAudience?.trim() || null,
      references: references?.trim() || null,
      directorStatement: directorStatement?.trim() || null,
      productionCompany: productionCompany?.trim() || null,
      previousWorkSummary: previousWorkSummary?.trim() || null,
      intendedRelease: intendedRelease?.trim() || null,
      keyCastCrew: keyCastCrew?.trim() || null,
      financingStatus: financingStatus?.trim() || null,
    };

    let pitch;
    if (pitchId?.trim()) {
      const existing = await prisma.originalPitch.findFirst({
        where: { id: pitchId.trim(), creatorId: session.user.id },
        select: { id: true, submissionTimeline: true, resubmissionCount: true },
      });
      if (!existing) {
        return NextResponse.json({ error: "Pitch not found for resubmission." }, { status: 404 });
      }
      const previousTimeline = Array.isArray(existing.submissionTimeline)
        ? (existing.submissionTimeline as Prisma.JsonArray)
        : [];
      pitch = await prisma.originalPitch.update({
        where: { id: existing.id },
        data: {
          ...currentData,
          status: "SUBMITTED",
          adminNote: null,
          reviewReasonCodes: null,
          reviewWeightedScore: null,
          resubmissionCount: (existing.resubmissionCount ?? 0) + 1,
          submissionTimeline: [
            ...previousTimeline,
            { type: "RESUBMITTED", at: new Date().toISOString(), note: "Creator resubmitted updated materials." },
          ] as Prisma.InputJsonValue,
        },
      });
    } else {
      const recentRequested = await prisma.originalPitch.findFirst({
        where: {
          creatorId: session.user.id,
          title: title.trim(),
          status: { in: ["CHANGES_REQUESTED"] },
        },
        orderBy: { updatedAt: "desc" },
        select: { id: true, submissionTimeline: true, resubmissionCount: true },
      });
      if (recentRequested) {
        const previousTimeline = Array.isArray(recentRequested.submissionTimeline)
          ? (recentRequested.submissionTimeline as Prisma.JsonArray)
          : [];
        pitch = await prisma.originalPitch.update({
          where: { id: recentRequested.id },
          data: {
            ...currentData,
            status: "SUBMITTED",
            adminNote: null,
            reviewReasonCodes: null,
            reviewWeightedScore: null,
            resubmissionCount: (recentRequested.resubmissionCount ?? 0) + 1,
            submissionTimeline: [
              ...previousTimeline,
              { type: "RESUBMITTED", at: new Date().toISOString(), note: "Auto-linked resubmission after changes requested." },
            ] as Prisma.InputJsonValue,
          },
        });
      } else {
        pitch = await prisma.originalPitch.create({
          data: {
            ...currentData,
            creatorId: session.user.id,
            submissionTimeline: [timelineEntry] as Prisma.InputJsonValue,
          },
        });
      }
    }
    return NextResponse.json(pitch);
  }

  if (action === "REVIEW_PITCH" && role === "ADMIN") {
    const { pitchId, status, adminNote, projectId, rubric, reasonCodes } = body;
    const adminId = session.user.id;
    const parsedRubric = parseRubric(rubric);
    if (!parsedRubric) {
      return NextResponse.json(
        { error: "Rubric is required. Provide story, marketability, feasibility, and teamReadiness scores (0-10)." },
        { status: 400 },
      );
    }
    const normalizedReasonCodes = Array.isArray(reasonCodes)
      ? Array.from(
          new Set(
            reasonCodes
              .map((code) => (typeof code === "string" ? code.trim().toUpperCase() : ""))
              .filter((code): code is string => REVIEW_REASON_CODES.includes(code as (typeof REVIEW_REASON_CODES)[number])),
          ),
        )
      : [];
    if ((status === "DECLINED" || status === "CHANGES_REQUESTED") && normalizedReasonCodes.length === 0) {
      return NextResponse.json(
        { error: "At least one reason code is required for Declined or Changes Requested decisions." },
        { status: 400 },
      );
    }
    const weightedScore = computeWeightedScore(parsedRubric);

    try {
      const result = await prisma.$transaction(async (tx) => {
        const existingPitch = await tx.originalPitch.findUnique({
          where: { id: pitchId },
          include: { project: true },
        });

        if (!existingPitch) {
          throw new Error("Pitch not found");
        }

        let resolvedProjectId = projectId ?? existingPitch.projectId ?? null;

        if (status === "APPROVED" && !resolvedProjectId) {
          const createdProject = await tx.originalProject.create({
            data: {
              title: existingPitch.title,
              logline: existingPitch.logline,
              synopsis: existingPitch.synopsis,
              type: existingPitch.type,
              genre: existingPitch.genre,
              status: "DEVELOPMENT",
              phase: "CONCEPT",
              budget: existingPitch.budgetEst ?? null,
            },
          });

          resolvedProjectId = createdProject.id;

          await tx.originalMember.create({
            data: {
              projectId: createdProject.id,
              userId: existingPitch.creatorId,
              role: "Creator",
              department: "Producing",
              status: "ACTIVE",
            },
          });
        }

        const updated = await tx.originalPitch.update({
          where: { id: pitchId },
          data: {
            status,
            adminNote: adminNote || null,
            projectId: resolvedProjectId,
            reviewRubric: {
              story: parsedRubric.story,
              marketability: parsedRubric.marketability,
              feasibility: parsedRubric.feasibility,
              teamReadiness: parsedRubric.teamReadiness,
              weightedScore,
              updatedAt: new Date().toISOString(),
            } as Prisma.InputJsonValue,
            reviewWeightedScore: weightedScore,
            reviewReasonCodes: normalizedReasonCodes.join(","),
            submissionTimeline: [
              ...(Array.isArray(existingPitch.submissionTimeline)
                ? (existingPitch.submissionTimeline as Prisma.JsonArray)
                : []),
              {
                type: "REVIEWED",
                at: new Date().toISOString(),
                status,
                reasonCodes: normalizedReasonCodes,
                weightedScore,
                adminId,
              },
            ] as Prisma.InputJsonValue,
          },
          include: {
            creator: { select: { id: true, name: true, email: true } },
            project: { select: { id: true, title: true } },
          },
        });

        return updated;
      });

    const notifyStatuses = ["APPROVED", "DECLINED", "CHANGES_REQUESTED"] as const;
    if ((notifyStatuses as readonly string[]).includes(result.status)) {
      const projectUrl = result.project?.id
        ? `/creator/projects/${result.project.id}/workspace`
        : "/creator/originals/submit";
      const titles: Record<string, string> = {
        APPROVED: "Your Originals pitch was approved",
        DECLINED: "Originals pitch update",
        CHANGES_REQUESTED: "Changes requested on your Originals pitch",
      };
      const bodies: Record<string, string> = {
        APPROVED: `"${result.title}" is approved (score: ${weightedScore}/100). Your project workspace is ready.`,
        DECLINED: `"${result.title}" was not approved (score: ${weightedScore}/100). See Originals for admin notes and reason codes.`,
        CHANGES_REQUESTED: `Please update "${result.title}" and resubmit (score: ${weightedScore}/100). See Originals for details and reason codes.`,
      };
      const t = titles[result.status] ?? "Originals pitch updated";
      const b = bodies[result.status] ?? `Your pitch "${result.title}" was updated.`;

      await notifyUser({
        userId: result.creatorId,
        type: "ORIGINALS_PITCH_DECISION",
        title: t,
        body: b,
        metadata: { url: projectUrl, pitchId: result.id, projectId: result.project?.id ?? undefined },
        email: {
          subject: t,
          text: `${b}\n\nOpen: ${buildAppUrl(projectUrl)}`,
        },
      });

      await prisma.adminAuditLog.create({
        data: {
          adminUserId: adminId,
          action: "ORIGINALS_PITCH_REVIEW",
          entityType: "OriginalPitch",
          entityId: result.id,
          newValue: {
            status: result.status,
            projectId: result.projectId,
            adminNote: result.adminNote,
            weightedScore,
            reasonCodes: normalizedReasonCodes,
          } as Prisma.InputJsonValue,
        },
      });
    }

      return NextResponse.json(result);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed";
      const statusCode = msg === "Pitch not found" ? 404 : 500;
      return NextResponse.json({ error: msg }, { status: statusCode });
    }
  }

  if (action === "PROMOTE_IDEA" && role === "ADMIN") {
    const { ideaId } = body as { ideaId?: string };
    if (!ideaId) {
      return NextResponse.json({ error: "ideaId is required" }, { status: 400 });
    }

    const result = await prisma.$transaction(async (tx) => {
      const idea = await tx.projectIdea.findUnique({
        where: { id: ideaId },
        include: { user: true },
      });

      if (!idea || !idea.userId) {
        throw new Error("Idea not found or not linked to a creator");
      }

      const project = await tx.originalProject.create({
        data: {
          title: idea.title,
          logline: idea.logline,
          synopsis: idea.notes,
          type: "Film",
          genre: idea.genres,
          status: "DEVELOPMENT",
          phase: "CONCEPT",
        },
      });

      await tx.originalMember.create({
        data: {
          projectId: project.id,
          userId: idea.userId,
          role: "Creator",
          department: "Producing",
          status: "ACTIVE",
        },
      });

      await tx.projectIdea.update({
        where: { id: idea.id },
        data: {
          projectId: project.id,
          convertedToProject: true,
        },
      });

      return { projectId: project.id, projectTitle: project.title };
    });

    return NextResponse.json(result);
  }

  if (action === "UPDATE_PROJECT" && role === "ADMIN") {
    const { projectId, status, phase, adminNote, budget } = body;
    const data: Record<string, unknown> = {};
    if (status) data.status = status;
    if (phase) data.phase = phase;
    if (adminNote !== undefined) data.adminNote = adminNote;
    if (budget !== undefined) data.budget = Number(budget);
    const updated = await prisma.originalProject.update({ where: { id: projectId }, data });
    return NextResponse.json(updated);
  }

  if (action === "ADD_MEMBER" && role === "ADMIN") {
    const { projectId, userId, memberRole, department } = body;
    const member = await prisma.originalMember.create({
      data: { projectId, userId, role: memberRole, department: department || null, status: "INVITED" },
    });
    return NextResponse.json(member);
  }

  if (action === "RESPOND_INVITE") {
    const { memberId, accept } = body;
    const member = await prisma.originalMember.findUnique({ where: { id: memberId } });
    if (!member || member.userId !== session.user.id) return NextResponse.json({ error: "Not authorized" }, { status: 403 });
    const updated = await prisma.originalMember.update({
      where: { id: memberId },
      data: { status: accept ? "ACTIVE" : "DECLINED" },
    });
    return NextResponse.json(updated);
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}
