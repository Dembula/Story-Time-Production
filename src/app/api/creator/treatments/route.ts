import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ensureProjectAccess } from "@/lib/project-access";
import {
  ensureCreatorSession,
  toRecord,
} from "@/lib/treatment-studio/access";
import {
  createDefaultDocument,
  parseTreatmentDocument,
  serializeTreatmentForDb,
} from "@/lib/treatment-studio/document";
import type { TreatmentDocument } from "@/lib/treatment-studio/types";

export async function GET(req: NextRequest) {
  const access = await ensureCreatorSession();
  if (access.error) return access.error;

  const projectIdParam = req.nextUrl.searchParams.get("projectId");

  if (projectIdParam) {
    const gate = await ensureProjectAccess(projectIdParam);
    if (gate.error) return gate.error;

    const treatments = await prisma.creatorTreatment.findMany({
      where: { projectId: projectIdParam },
      orderBy: { updatedAt: "desc" },
      include: { project: { select: { title: true } } },
    });

    return NextResponse.json({
      treatments: treatments.map((t) => toRecord(t, t.project?.title ?? "")),
    });
  }

  const treatments = await prisma.creatorTreatment.findMany({
    where: { userId: access.userId!, projectId: null },
    orderBy: { updatedAt: "desc" },
  });

  return NextResponse.json({
    treatments: treatments.map((t) => toRecord(t)),
  });
}

export async function POST(req: NextRequest) {
  const access = await ensureCreatorSession();
  if (access.error) return access.error;

  const body = (await req.json().catch(() => null)) as
    | {
        title?: string;
        projectId?: string | null;
        document?: TreatmentDocument;
      }
    | null;

  const projectId =
    body?.projectId === undefined
      ? null
      : body.projectId === null || body.projectId === ""
        ? null
        : body.projectId;

  if (projectId) {
    const gate = await ensureProjectAccess(projectId);
    if (gate.error) return gate.error;
  }

  const document = body?.document
    ? parseTreatmentDocument(body.document)
    : createDefaultDocument();

  const treatment = await prisma.creatorTreatment.create({
    data: {
      userId: access.userId!,
      projectId,
      title: body?.title?.trim() || "Untitled Treatment",
      document: serializeTreatmentForDb(document),
    },
    include: { project: { select: { title: true } } },
  });

  if (projectId) {
    await prisma.projectActivity.create({
      data: {
        projectId,
        userId: access.userId!,
        type: "TREATMENT_CREATED",
        message: `New treatment "${treatment.title}" added to the project.`,
        metadata: JSON.stringify({ treatmentId: treatment.id }),
      },
    });
  }

  return NextResponse.json(
    { treatment: toRecord(treatment, treatment.project?.title ?? "") },
    { status: 201 },
  );
}
