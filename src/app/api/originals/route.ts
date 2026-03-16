import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

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
      intendedRelease, keyCastCrew, financingStatus,
    } = body;
    if (!title?.trim() || !logline?.trim()) {
      return NextResponse.json({ error: "Title and logline are required" }, { status: 400 });
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
    const pitch = await prisma.originalPitch.create({
      data: {
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
        budgetEst: budgetEst ? Number(budgetEst) : null,
        targetAudience: targetAudience?.trim() || null,
        references: references?.trim() || null,
        directorStatement: directorStatement?.trim() || null,
        productionCompany: productionCompany?.trim() || null,
        previousWorkSummary: previousWorkSummary?.trim() || null,
        intendedRelease: intendedRelease?.trim() || null,
        keyCastCrew: keyCastCrew?.trim() || null,
        financingStatus: financingStatus?.trim() || null,
        creatorId: session.user.id,
      },
    });
    return NextResponse.json(pitch);
  }

  if (action === "REVIEW_PITCH" && role === "ADMIN") {
    const { pitchId, status, adminNote, projectId } = body;

    const result = await prisma.$transaction(async (tx) => {
      const existingPitch = await tx.originalPitch.findUnique({
        where: { id: pitchId },
        include: { project: true },
      });

      if (!existingPitch) {
        throw new Error("Pitch not found");
      }

      let resolvedProjectId = projectId ?? existingPitch.projectId ?? null;

      // When an Originals submission is approved, ensure it is backed by an OriginalProject
      // and that the creator is attached as a member so it appears in their dashboard pipeline.
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

        // Attach the pitch creator as the lead creator on the new project
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
        },
        include: {
          creator: { select: { id: true, name: true, email: true } },
          project: { select: { id: true, title: true } },
        },
      });

      return updated;
    });

    return NextResponse.json(result);
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
