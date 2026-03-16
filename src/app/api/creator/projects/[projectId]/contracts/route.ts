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

  const contracts = await prisma.projectContract.findMany({
    where: { projectId },
    orderBy: { createdAt: "desc" },
    include: {
      versions: { orderBy: { version: "desc" }, take: 1 },
      signatures: true,
      castingTalent: { select: { id: true, name: true } },
      crewTeam: { select: { id: true, companyName: true } },
      locationListing: { select: { id: true, name: true } },
    },
  });

  return NextResponse.json({
    contracts: contracts.map((c) => ({
      id: c.id,
      type: c.type,
      status: c.status,
      subject: c.subject,
      createdAt: c.createdAt,
      latestVersion: c.versions[0]
        ? { id: c.versions[0].id, version: c.versions[0].version }
        : null,
      signaturesCount: c.signatures.length,
      actor: c.castingTalent ? { id: c.castingTalent.id, name: c.castingTalent.name } : null,
      crewTeam: c.crewTeam ? { id: c.crewTeam.id, name: c.crewTeam.companyName } : null,
      location:
        c.locationListing && "name" in c.locationListing
          ? { id: c.locationListing.id, name: (c.locationListing as any).name as string }
          : null,
      vendorName: c.vendorName,
    })),
  });
}

export async function POST(req: NextRequest, { params }: Params) {
  const { projectId } = await params;
  const access = await ensureProjectAccess(projectId);
  if (access.error) return access.error;
  const userId = access.userId!;

  const body = (await req.json().catch(() => null)) as
    | {
        type: string;
        subject?: string | null;
        counterpartyUserId?: string | null;
        castingTalentId?: string | null;
        crewTeamId?: string | null;
        locationListingId?: string | null;
        vendorName?: string | null;
        terms?: string;
      }
    | null;

  if (!body?.type) {
    return NextResponse.json({ error: "Missing type" }, { status: 400 });
  }

  const contract = await prisma.projectContract.create({
    data: {
      projectId,
      type: body.type,
      subject: body.subject ?? null,
      counterpartyUserId: body.counterpartyUserId ?? null,
      castingTalentId: body.castingTalentId ?? null,
      crewTeamId: body.crewTeamId ?? null,
      locationListingId: body.locationListingId ?? null,
      vendorName: body.vendorName ?? null,
      createdById: userId,
    },
  });

  if (body.terms) {
    const version = await prisma.projectContractVersion.create({
      data: {
        contractId: contract.id,
        version: 1,
        terms: body.terms,
        createdById: userId,
      },
    });
    await prisma.projectContract.update({
      where: { id: contract.id },
      data: { currentVersionId: version.id },
    });
  }

  const updated = await prisma.projectContract.findUnique({
    where: { id: contract.id },
    include: { versions: true },
  });

  return NextResponse.json({ contract: updated ?? contract }, { status: 201 });
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const { projectId } = await params;
  const access = await ensureProjectAccess(projectId);
  if (access.error) return access.error;
  const userId = access.userId!;

  const body = (await req.json().catch(() => null)) as
    | {
        id: string;
        subject?: string | null;
        status?: string;
        terms?: string;
        changeNotes?: string | null;
      }
    | null;

  if (!body?.id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  const existing = await prisma.projectContract.findFirst({
    where: { id: body.id, projectId },
    include: { versions: { orderBy: { version: "desc" }, take: 1 } },
  });

  if (!existing) {
    return NextResponse.json({ error: "Contract not found" }, { status: 404 });
  }

  const updateData: { subject?: string; status?: string } = {};
  if (body.subject !== undefined) updateData.subject = body.subject ?? undefined;
  if (body.status !== undefined) updateData.status = body.status;

  await prisma.projectContract.update({
    where: { id: body.id },
    data: updateData,
  });

  if (body.terms !== undefined) {
    const nextVersion = (existing.versions[0]?.version ?? 0) + 1;
    const version = await prisma.projectContractVersion.create({
      data: {
        contractId: body.id,
        version: nextVersion,
        terms: body.terms,
        changeNotes: body.changeNotes ?? null,
        createdById: userId,
      },
    });
    await prisma.projectContract.update({
      where: { id: body.id },
      data: { currentVersionId: version.id },
    });
  }

  const contract = await prisma.projectContract.findUnique({
    where: { id: body.id },
    include: { versions: { orderBy: { version: "desc" } }, signatures: true },
  });

  return NextResponse.json({ contract });
}
