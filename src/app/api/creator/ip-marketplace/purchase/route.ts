import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

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

export async function POST(req: Request) {
  const access = await ensureCreator();
  if (access.error) return access.error;
  const buyerId = access.userId!;

  const body = (await req.json().catch(() => null)) as
    | {
        ipAssetId?: string;
        mode?: "BUY_NOW" | "LICENSE_NOW";
        territory?: string;
        duration?: string;
        revenueSharePercentage?: number;
      }
    | null;
  if (!body?.ipAssetId) {
    return NextResponse.json({ error: "ipAssetId is required" }, { status: 400 });
  }

  const now = new Date();

  try {
    const result = await prisma.$transaction(async (tx) => {
      const asset = await tx.iPAsset.findUnique({
        where: { id: body.ipAssetId },
        include: {
          creatorScript: true,
          versions: { orderBy: { versionNumber: "desc" }, take: 1 },
        },
      });

      if (!asset) throw new Error("Asset not found");
      if (asset.currentOwnerId === buyerId) throw new Error("You already own this script");
      if (asset.status !== "LISTED") throw new Error("Asset is not currently listed");
      if (!asset.listingPrice || asset.listingPrice <= 0) throw new Error("Listing price is invalid");
      if (!asset.creatorScript) throw new Error("Asset has no linked script");
      if (asset.monetizationModel === "CO_PRODUCE") {
        throw new Error("Co-produce assets require negotiated deals and cannot be instant-purchased");
      }

      const sellerId = asset.currentOwnerId;

      if (asset.monetizationModel === "SALE_FULL_RIGHTS") {
        // Atomic guard: prevents double-sale races.
        const updated = await tx.iPAsset.updateMany({
          where: {
            id: asset.id,
            currentOwnerId: sellerId,
            status: "LISTED",
          },
          data: {
            currentOwnerId: buyerId,
            status: "SOLD",
          },
        });
        if (updated.count === 0) throw new Error("Asset was sold by another buyer");

        // Transfer script ownership from seller to buyer: it disappears for seller and appears for buyer.
        await tx.creatorScript.update({
          where: { id: asset.creatorScript.id },
          data: { userId: buyerId },
        });

        await tx.iPOwnershipStructure.updateMany({
          where: { ipAssetId: asset.id, endDate: null },
          data: { endDate: now },
        });

        await tx.iPOwnershipStructure.create({
          data: {
            ipAssetId: asset.id,
            ownerId: buyerId,
            ownershipPercentage: 100,
            rightsType: "FULL",
            startDate: now,
          },
        });

        await tx.iPVersion.updateMany({
          where: { ipAssetId: asset.id, isLocked: false },
          data: { isLocked: true },
        });
      }

      if (asset.monetizationModel === "LICENSE") {
        await tx.iPLicensingAgreement.create({
          data: {
            ipAssetId: asset.id,
            licensorId: sellerId,
            licenseeId: buyerId,
            licenseType: "NON_EXCLUSIVE",
            territory: (body?.territory || "Worldwide").slice(0, 120),
            duration: (body?.duration || "12 months").slice(0, 80),
            revenueSharePercentage:
              typeof body?.revenueSharePercentage === "number" && Number.isFinite(body.revenueSharePercentage)
                ? Math.max(0, Math.min(100, body.revenueSharePercentage))
                : null,
            status: "ACTIVE",
          },
        });
      }

      const transaction = await tx.iPTransaction.create({
        data: {
          ipAssetId: asset.id,
          buyerId,
          sellerId,
          type: asset.monetizationModel === "LICENSE" ? "LICENSE" : "SALE",
          amount: asset.listingPrice,
          currency: asset.listingCurrency || "ZAR",
          date: now,
          metadata: {
            monetizationModel: asset.monetizationModel,
            title: asset.title,
          },
        },
      });

      await tx.activityLog.createMany({
        data: [
          {
            userId: buyerId,
            role: "CONTENT_CREATOR",
            eventType: asset.monetizationModel === "LICENSE" ? "IP_LICENSE_PURCHASED" : "IP_PURCHASED",
            userName: null,
            userEmail: null,
          },
          {
            userId: sellerId,
            role: "CONTENT_CREATOR",
            eventType: asset.monetizationModel === "LICENSE" ? "IP_LICENSE_SOLD" : "IP_SOLD",
            userName: null,
            userEmail: null,
          },
        ],
      });

      return transaction;
    });

    return NextResponse.json({ ok: true, transactionId: result.id });
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message || "Purchase failed" },
      { status: 400 },
    );
  }
}
