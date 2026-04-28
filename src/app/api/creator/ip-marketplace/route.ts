import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { computeScriptMetrics, parseLimit, validateListingInputs } from "@/lib/ip-marketplace";

const CREATOR_ROLES = new Set(["CONTENT_CREATOR", "ADMIN"]);

async function ensureCreator() {
  const session = await getServerSession(authOptions);
  const role = (session?.user as { role?: string } | undefined)?.role;
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!session || !userId || !role || !CREATOR_ROLES.has(role)) {
    return { userId: null as string | null, error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  return { userId, error: null as NextResponse | null };
}

export async function GET(req: NextRequest) {
  const access = await ensureCreator();
  if (access.error) return access.error;

  const userId = access.userId!;
  const projectId = req.nextUrl.searchParams.get("projectId");
  const limit = parseLimit(req.nextUrl.searchParams.get("limit"));

  const listedAssets = await prisma.iPAsset.findMany({
    where: {
      status: "LISTED",
      currentOwnerId: { not: userId },
      ...(projectId ? { creatorScript: { projectId } } : {}),
    },
    include: {
      currentOwner: { select: { id: true, name: true, professionalName: true } },
      creatorScript: { select: { id: true } },
    },
    orderBy: { listedAt: "desc" },
    take: limit,
  });

  const myAssets = await prisma.iPAsset.findMany({
    where: { currentOwnerId: userId },
    include: {
      creatorScript: { select: { id: true, title: true, projectId: true, updatedAt: true } },
      ownershipStructures: {
        where: { endDate: null },
        select: { ownerId: true, ownershipPercentage: true, rightsType: true },
      },
      licensingAgreements: {
        where: { status: "ACTIVE" },
        select: { id: true, licenseType: true, territory: true, duration: true, revenueSharePercentage: true },
      },
    },
    orderBy: { updatedAt: "desc" },
    take: limit,
  });

  const purchased = await prisma.iPTransaction.findMany({
    where: { buyerId: userId },
    include: {
      ipAsset: { select: { id: true, title: true, status: true } },
      seller: { select: { id: true, name: true, professionalName: true } },
    },
    orderBy: { date: "desc" },
    take: limit,
  });

  const sold = await prisma.iPTransaction.findMany({
    where: { sellerId: userId },
    include: {
      ipAsset: { select: { id: true, title: true, status: true } },
      buyer: { select: { id: true, name: true, professionalName: true } },
    },
    orderBy: { date: "desc" },
    take: limit,
  });

  const integrity = {
    totalOwnedAssets: myAssets.length,
    listedByMe: myAssets.filter((a) => a.status === "LISTED").length,
    withInvalidOwnershipSplit: myAssets.filter((a) => {
      const active = a.ownershipStructures.filter((o) => o.ownershipPercentage > 0);
      const total = active.reduce((sum, o) => sum + o.ownershipPercentage, 0);
      return Math.abs(total - 100) > 0.01;
    }).map((a) => a.id),
  };

  return NextResponse.json({
    listedAssets,
    myAssets,
    purchased,
    sold,
    integrity,
  });
}

export async function POST(req: NextRequest) {
  const access = await ensureCreator();
  if (access.error) return access.error;
  const userId = access.userId!;

  const body = (await req.json().catch(() => null)) as
    | {
        creatorScriptId?: string;
        title?: string;
        logline?: string;
        synopsis?: string;
        genre?: string;
        language?: string;
        themes?: string;
        monetizationModel?: "SALE_FULL_RIGHTS" | "LICENSE" | "CO_PRODUCE";
        listingPrice?: number;
        listingCurrency?: string;
      }
    | null;

  if (!body?.creatorScriptId) {
    return NextResponse.json({ error: "creatorScriptId is required" }, { status: 400 });
  }
  const validated = validateListingInputs({
    title: body.title,
    logline: body.logline,
    synopsis: body.synopsis,
    genre: body.genre,
    language: body.language,
    themes: body.themes,
    listingPrice: body.listingPrice,
    listingCurrency: body.listingCurrency,
    monetizationModel: body.monetizationModel,
  });
  if ("error" in validated) return NextResponse.json({ error: validated.error }, { status: 400 });

  const script = await prisma.creatorScript.findFirst({
    where: { id: body.creatorScriptId, userId },
  });
  if (!script) {
    return NextResponse.json({ error: "Script not found or not owned by you" }, { status: 404 });
  }
  if (!script.content?.trim()) {
    return NextResponse.json({ error: "Script is empty. Add content before listing." }, { status: 400 });
  }

  const existing = await prisma.iPAsset.findUnique({
    where: { creatorScriptId: script.id },
    include: {
      versions: { orderBy: { versionNumber: "desc" }, take: 1 },
      ownershipStructures: { where: { endDate: null }, take: 1 },
    },
  });

  const metrics = computeScriptMetrics(script.content ?? "");
  const now = new Date();
  const data = {
    title: validated.value.title || script.title,
    logline: validated.value.logline || null,
    synopsis: validated.value.synopsis || null,
    genre: validated.value.genre || null,
    language: validated.value.language || null,
    themes: validated.value.themes || null,
    monetizationModel: validated.value.monetizationModel,
    listingPrice: validated.value.listingPrice,
    listingCurrency: validated.value.listingCurrency,
    status: "LISTED",
    listedAt: now,
    currentOwnerId: userId,
  } as const;

  if (!existing) {
    const created = await prisma.$transaction(async (tx) => {
      const asset = await tx.iPAsset.create({
        data: {
          creatorScriptId: script.id,
          ...data,
          originalCreatorId: userId,
        },
      });
      await tx.iPVersion.create({
        data: {
          ipAssetId: asset.id,
          versionNumber: 1,
          content: script.content,
          notes: `Initial marketplace listing version | words=${metrics.wordCount} | tokens=${metrics.tokenEstimate} | sha256=${metrics.contentHash}`,
          isLocked: false,
        },
      });
      await tx.iPOwnershipStructure.create({
        data: {
          ipAssetId: asset.id,
          ownerId: userId,
          ownershipPercentage: 100,
          rightsType: "FULL",
          startDate: now,
          endDate: null,
        },
      });
      return asset;
    });
    return NextResponse.json({ asset: created }, { status: 201 });
  }

  const latestVersion = existing.versions[0];
  await prisma.$transaction(async (tx) => {
    await tx.iPAsset.update({
      where: { id: existing.id },
      data,
    });

    if (script.content !== (latestVersion?.content ?? "")) {
      await tx.iPVersion.create({
        data: {
          ipAssetId: existing.id,
          versionNumber: (latestVersion?.versionNumber ?? 0) + 1,
          content: script.content,
          notes: `Updated from script tool before listing | words=${metrics.wordCount} | tokens=${metrics.tokenEstimate} | sha256=${metrics.contentHash}`,
          isLocked: false,
        },
      });
    }

    if (existing.ownershipStructures.length === 0) {
      await tx.iPOwnershipStructure.create({
        data: {
          ipAssetId: existing.id,
          ownerId: userId,
          ownershipPercentage: 100,
          rightsType: "FULL",
          startDate: now,
        },
      });
    }
  });

  return NextResponse.json({ ok: true });
}
