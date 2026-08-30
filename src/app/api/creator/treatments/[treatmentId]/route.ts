import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ensureProjectAccess } from "@/lib/project-access";
import {
  ensureTreatmentAccess,
  toRecord,
} from "@/lib/treatment-studio/access";
import {
  parseTreatmentDocument,
  serializeTreatmentForDb,
} from "@/lib/treatment-studio/document";
import type { TreatmentDocument } from "@/lib/treatment-studio/types";

type RouteParams = { params: Promise<{ treatmentId: string }> };

export async function GET(_req: NextRequest, { params }: RouteParams) {
  const { treatmentId } = await params;
  const gate = await ensureTreatmentAccess(treatmentId);
  if (gate.error) return gate.error;
  return NextResponse.json({
    treatment: gate.access!.treatment,
    canWrite: gate.access!.canWrite,
  });
}

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const { treatmentId } = await params;
  const gate = await ensureTreatmentAccess(treatmentId);
  if (gate.error) return gate.error;
  if (!gate.access!.canWrite) {
    return NextResponse.json({ error: "Read-only access" }, { status: 403 });
  }

  const body = (await req.json().catch(() => null)) as
    | {
        title?: string;
        document?: TreatmentDocument;
        projectId?: string | null;
        expectedUpdatedAt?: string;
      }
    | null;

  if (
    body?.expectedUpdatedAt &&
    gate.access!.raw.updatedAt.toISOString() !== body.expectedUpdatedAt
  ) {
    return NextResponse.json(
      {
        error: "conflict",
        treatment: gate.access!.treatment,
        message: "Another session saved changes. Reload to merge.",
      },
      { status: 409 },
    );
  }

  const data: {
    title?: string;
    document?: object;
    projectId?: string | null;
  } = {};

  if (body?.title !== undefined) {
    data.title = body.title.trim() || "Untitled Treatment";
  }
  if (body?.document !== undefined) {
    data.document = serializeTreatmentForDb(parseTreatmentDocument(body.document));
  }
  if (body?.projectId !== undefined) {
    const projectId =
      body.projectId === null || body.projectId === "" ? null : body.projectId;
    if (projectId) {
      const projectGate = await ensureProjectAccess(projectId);
      if (projectGate.error) return projectGate.error;
    }
    data.projectId = projectId;
  }

  const updated = await prisma.creatorTreatment.update({
    where: { id: treatmentId },
    data,
    include: { project: { select: { title: true } } },
  });

  return NextResponse.json({
    treatment: toRecord(updated, updated.project?.title ?? ""),
  });
}

export async function DELETE(req: NextRequest, { params }: RouteParams) {
  const { treatmentId } = await params;
  const gate = await ensureTreatmentAccess(treatmentId);
  if (gate.error) return gate.error;
  if (!gate.access!.canWrite) {
    return NextResponse.json({ error: "Read-only access" }, { status: 403 });
  }

  const body = (await req.json().catch(() => null)) as { confirm?: string } | null;
  const { parseDeleteConfirm, CONFIRM_DELETE_TREATMENT } = await import("@/lib/confirm-delete");
  const confirmGate = parseDeleteConfirm(body, CONFIRM_DELETE_TREATMENT);
  if (!confirmGate.ok) {
    return NextResponse.json({ error: confirmGate.error }, { status: 400 });
  }

  await prisma.creatorTreatment.delete({ where: { id: treatmentId } });
  return NextResponse.json({ ok: true, id: treatmentId });
}
