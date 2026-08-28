import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ensureProjectAccess } from "@/lib/project-access";
import { parseTreatmentDocument } from "./document";
import type { CreatorTreatmentRecord, TreatmentDocument } from "./types";

export async function ensureCreatorSession() {
  const session = await getServerSession(authOptions);
  const role = (session?.user as { role?: string })?.role;
  const userId = (session?.user as { id?: string })?.id;

  if (!session || !userId || (role !== "CONTENT_CREATOR" && role !== "ADMIN")) {
    return {
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
      userId: null as string | null,
      isAdmin: false,
    };
  }

  return { error: null as NextResponse | null, userId, isAdmin: role === "ADMIN" };
}

function toRecord(
  row: {
    id: string;
    userId: string;
    projectId: string | null;
    title: string;
    document: unknown;
    createdAt: Date;
    updatedAt: Date;
  },
  projectTitle = "",
): CreatorTreatmentRecord {
  return {
    id: row.id,
    userId: row.userId,
    projectId: row.projectId,
    title: row.title,
    document: parseTreatmentDocument(row.document),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    projectTitle,
  };
}

export async function ensureTreatmentAccess(treatmentId: string) {
  const session = await ensureCreatorSession();
  if (session.error) return { error: session.error, access: null as null };

  const row = await prisma.creatorTreatment.findUnique({
    where: { id: treatmentId },
    include: {
      project: { select: { id: true, title: true } },
    },
  });

  if (!row) {
    return {
      error: NextResponse.json({ error: "Treatment not found" }, { status: 404 }),
      access: null as null,
    };
  }

  if (row.userId !== session.userId && !session.isAdmin) {
    if (row.projectId) {
      const gate = await ensureProjectAccess(row.projectId);
      if (gate.error) return { error: gate.error, access: null as null };
    } else {
      return {
        error: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
        access: null as null,
      };
    }
  }

  const treatment = toRecord(row, row.project?.title ?? "");
  const canWrite =
    session.isAdmin || row.userId === session.userId || Boolean(row.projectId);

  return {
    error: null as NextResponse | null,
    access: {
      treatment,
      canWrite,
      raw: row,
    },
  };
}

export { toRecord };
