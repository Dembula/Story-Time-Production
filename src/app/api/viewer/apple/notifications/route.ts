import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { decodeAppleJwsPayload, verifyAppleTransactionJws } from "@/lib/payments/apple-iap/jws";
import {
  APPLE_UNIVERSE_PPV_PRODUCT_ID,
  resolveCreatorAppleProduct,
  resolveUniverseSubscriptionProduct,
} from "@/lib/payments/apple-iap/products";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type NotificationOuter = {
  notificationType?: string;
  subtype?: string;
  data?: {
    signedTransactionInfo?: string;
    bundleId?: string;
    environment?: string;
  };
};

function decodeOuterNotification(signedPayload: string): NotificationOuter {
  // Outer ASN v2 payload is a JWS; payload is not a store transaction object.
  const parts = signedPayload.trim().split(".");
  if (parts.length !== 3) throw new Error("Invalid signedPayload");
  return JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8")) as NotificationOuter;
}

/**
 * App Store Server Notifications V2 webhook.
 * App Store Connect URL: https://story-time.online/api/viewer/apple/notifications
 */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => null)) as { signedPayload?: string } | null;
    const signedPayload = body?.signedPayload?.trim();
    if (!signedPayload) {
      return NextResponse.json({ error: "signedPayload required" }, { status: 400 });
    }

    const notification = decodeOuterNotification(signedPayload);
    const notificationType = notification.notificationType ?? "UNKNOWN";
    const signedTx = notification.data?.signedTransactionInfo;

    if (!signedTx) {
      await prisma.paymentWebhookEvent
        .create({
          data: {
            provider: "APPLE",
            eventType: notificationType,
            payload: body as object,
            signatureVerified: false,
            processedAt: new Date(),
          },
        })
        .catch(() => {});
      return NextResponse.json({ ok: true, ignored: true });
    }

    let tx;
    try {
      tx = verifyAppleTransactionJws(signedTx).payload;
    } catch {
      tx = decodeAppleJwsPayload(signedTx);
    }

    const transactionId = tx.transactionId;
    const originalTransactionId = tx.originalTransactionId || transactionId;
    const productId = tx.productId;
    const eventId = `${notificationType}:${transactionId}`;

    await prisma.paymentWebhookEvent
      .create({
        data: {
          provider: "APPLE",
          eventType: notificationType,
          eventId,
          reference: originalTransactionId,
          payload: {
            notificationType,
            subtype: notification.subtype ?? null,
            productId,
            transactionId,
            environment: notification.data?.environment ?? tx.environment ?? null,
          },
          signatureVerified: true,
        },
      })
      .catch(() => {});

    const expiresAt =
      typeof tx.expiresDate === "number" && tx.expiresDate > 0 ? new Date(tx.expiresDate) : null;
    const revoked = Boolean(tx.revocationDate);

    const sub = await prisma.viewerSubscription.findFirst({
      where: { externalPaymentId: originalTransactionId },
      orderBy: { updatedAt: "desc" },
    });

    if (sub) {
      if (revoked || notificationType === "REFUND" || notificationType === "REVOKE") {
        await prisma.viewerSubscription.update({
          where: { id: sub.id },
          data: {
            status: "CANCELLED",
            cancelAtPeriodEnd: false,
            lastPaymentError: `Apple ${notificationType}`,
          },
        });
      } else if (notificationType === "DID_RENEW" || notificationType === "SUBSCRIBED") {
        await prisma.viewerSubscription.update({
          where: { id: sub.id },
          data: {
            status: "ACTIVE",
            currentPeriodEnd: expiresAt ?? sub.currentPeriodEnd,
            lastPaymentStatus: "SUCCEEDED",
            lastPaymentAt: new Date(),
            lastPaymentError: null,
          },
        });
      } else if (
        notificationType === "DID_CHANGE_RENEWAL_STATUS" &&
        notification.subtype === "AUTO_RENEW_DISABLED"
      ) {
        await prisma.viewerSubscription.update({
          where: { id: sub.id },
          data: { cancelAtPeriodEnd: true },
        });
      } else if (
        resolveUniverseSubscriptionProduct(productId) &&
        expiresAt &&
        expiresAt.getTime() <= Date.now()
      ) {
        await prisma.viewerSubscription.update({
          where: { id: sub.id },
          data: { status: "PAST_DUE", lastPaymentError: "Apple subscription expired" },
        });
      }
    }

    const license = await prisma.creatorDistributionLicense.findFirst({
      where: { externalPaymentId: originalTransactionId },
    });
    if (license) {
      if (revoked || notificationType === "REFUND" || notificationType === "REVOKE") {
        await prisma.creatorDistributionLicense.update({
          where: { id: license.id },
          data: {
            status: "CANCELLED",
            autoRenew: false,
            lastPaymentError: `Apple ${notificationType}`,
          },
        });
      } else if (notificationType === "DID_RENEW" || notificationType === "SUBSCRIBED") {
        await prisma.creatorDistributionLicense.update({
          where: { id: license.id },
          data: {
            status: "ACTIVE",
            yearlyExpiresAt: expiresAt ?? license.yearlyExpiresAt,
            lastPaymentStatus: "SUCCEEDED",
            lastPaymentAt: new Date(),
            lastPaymentError: null,
          },
        });
      } else if (resolveCreatorAppleProduct(productId) && expiresAt) {
        await prisma.creatorDistributionLicense.update({
          where: { id: license.id },
          data: { yearlyExpiresAt: expiresAt },
        });
      }
    }

    if (
      (productId === APPLE_UNIVERSE_PPV_PRODUCT_ID || productId.includes("ppv")) &&
      (revoked || notificationType === "REFUND")
    ) {
      await prisma.viewerContentAccess.updateMany({
        where: { externalPaymentId: transactionId },
        data: { status: "REFUNDED" },
      });
    }

    await prisma.paymentWebhookEvent
      .updateMany({
        where: { provider: "APPLE", eventId },
        data: { processedAt: new Date() },
      })
      .catch(() => {});

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("POST /api/viewer/apple/notifications", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Notification handling failed" },
      { status: 500 },
    );
  }
}
