import { NextRequest, NextResponse } from "next/server";
import { ensureProjectAccess } from "@/lib/project-access";
import { prisma } from "@/lib/prisma";

interface Params {
  params: Promise<{ projectId: string }>;
}

export async function GET(_req: NextRequest, { params }: Params) {
  const { projectId } = await params;
  const access = await ensureProjectAccess(projectId);
  if (access.error) return access.error;

  const funding = await prisma.fundingRequest.findUnique({
    where: { projectId },
  });

  return NextResponse.json({ funding: funding ?? null });
}

export async function POST(req: NextRequest, { params }: Params) {
  const { projectId } = await params;
  const access = await ensureProjectAccess(projectId);
  if (access.error) return access.error;

  const body = (await req.json().catch(() => null)) as
    | {
        option: "HAS_FUNDING" | "REQUEST_FUNDING";
        amount?: number | null;
        currency?: string | null;
        details?: string | null;
      }
    | null;

  if (!body?.option) {
    return NextResponse.json({ error: "Missing option" }, { status: 400 });
  }

  const existing = await prisma.fundingRequest.findUnique({
    where: { projectId },
  });

  if (existing) {
    const funding = await prisma.fundingRequest.update({
      where: { projectId },
      data: {
        option: body.option,
        amount: body.amount ?? null,
        currency: body.currency ?? "ZAR",
        details: body.details ?? null,
      },
    });
    return NextResponse.json({ funding });
  }

  const funding = await prisma.fundingRequest.create({
    data: {
      projectId,
      option: body.option,
      amount: body.amount ?? null,
      currency: body.currency ?? "ZAR",
      details: body.details ?? null,
    },
  });

  return NextResponse.json({ funding }, { status: 201 });
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const { projectId } = await params;
  const access = await ensureProjectAccess(projectId);
  if (access.error) return access.error;

  const body = (await req.json().catch(() => null)) as
    | {
        option?: "HAS_FUNDING" | "REQUEST_FUNDING";
        amount?: number | null;
        currency?: string | null;
        details?: string | null;
      }
    | null;

  const existing = await prisma.fundingRequest.findUnique({
    where: { projectId },
  });

  if (!existing) {
    return NextResponse.json({ error: "No funding request for this project" }, { status: 404 });
  }

  const funding = await prisma.fundingRequest.update({
    where: { projectId },
    data: {
      ...(body?.option !== undefined ? { option: body.option } : {}),
      ...(body?.amount !== undefined ? { amount: body.amount } : {}),
      ...(body?.currency !== undefined ? { currency: body.currency } : {}),
      ...(body?.details !== undefined ? { details: body.details } : {}),
    },
  });

  return NextResponse.json({ funding });
}
