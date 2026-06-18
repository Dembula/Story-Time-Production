import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isPayFastConfigured } from "@/lib/payments/config";
import { createPayFastCardConsentForUser } from "@/lib/payments/payfast-saved-card";
import { buildPaymentReturnUrl } from "@/lib/payments/return-url";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const methods = await prisma.viewerPaymentMethod.findMany({
    where: { userId: session.user.id },
    orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
    select: {
      id: true,
      label: true,
      lastFour: true,
      isDefault: true,
      provider: true,
      cardType: true,
      reusable: true,
      createdAt: true,
      authorizationCode: true,
    },
  });

  const legacyIds = methods.filter((m) => !m.authorizationCode).map((m) => m.id);
  if (legacyIds.length > 0) {
    await prisma.viewerPaymentMethod.deleteMany({
      where: { id: { in: legacyIds }, userId: session.user.id },
    });
  }

  const activeMethods = methods.filter((m) => m.authorizationCode);

  return NextResponse.json(
    activeMethods.map((m) => ({
      id: m.id,
      label: m.label,
      lastFour: m.lastFour,
      isDefault: m.isDefault,
      provider: m.provider,
      cardType: m.cardType,
      reusable: m.reusable,
      createdAt: m.createdAt,
      payfastTokenized: Boolean(m.authorizationCode),
    })),
  );
}

/** Start PayFast card tokenization — Story Time never collects card numbers. */
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const user = session?.user as { id?: string; email?: string | null; name?: string | null } | undefined;
  if (!user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!isPayFastConfigured()) {
    return NextResponse.json(
      { error: "PayFast is not configured. Card saving is handled by PayFast when checkout is live." },
      { status: 503 },
    );
  }

  const body = (await req.json().catch(() => null)) as { returnPath?: string } | null;
  const returnPath = body?.returnPath?.trim() || "/browse/settings";

  try {
    const consent = await createPayFastCardConsentForUser({
      userId: user.id,
      email: user.email,
      name: user.name,
      returnUrl: buildPaymentReturnUrl(returnPath, "payfast_card_consent"),
    });
    return NextResponse.json({
      ok: true,
      checkoutUrl: consent.checkoutUrl,
      message: "You will be redirected to PayFast to securely save your card. Story Time never stores card numbers.",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to start PayFast card setup.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { id, isDefault } = body as { id: string; isDefault: boolean };
  if (!id || !isDefault) return NextResponse.json({ error: "id and isDefault required" }, { status: 400 });

  const method = await prisma.viewerPaymentMethod.findFirst({
    where: { id, userId: session.user.id, authorizationCode: { not: null } },
  });
  if (!method) {
    return NextResponse.json(
      { error: "Only PayFast-tokenized cards can be set as default. Add a card through PayFast first." },
      { status: 404 },
    );
  }

  await prisma.viewerPaymentMethod.updateMany({
    where: { userId: session.user.id },
    data: { isDefault: false },
  });
  const updated = await prisma.viewerPaymentMethod.update({
    where: { id },
    data: { isDefault: true },
  });
  return NextResponse.json(updated);
}

export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const method = await prisma.viewerPaymentMethod.findFirst({
    where: { id, userId: session.user.id },
  });
  if (!method) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const tokenizedCount = await prisma.viewerPaymentMethod.count({
    where: { userId: session.user.id, authorizationCode: { not: null } },
  });
  if (method.authorizationCode && tokenizedCount <= 1) {
    return NextResponse.json(
      { error: "Keep at least one PayFast-saved card for renewals and marketplace checkout." },
      { status: 400 },
    );
  }

  await prisma.viewerPaymentMethod.delete({ where: { id } });
  if (method.isDefault) {
    const next = await prisma.viewerPaymentMethod.findFirst({
      where: { userId: session.user.id, authorizationCode: { not: null } },
      orderBy: { updatedAt: "desc" },
    });
    if (next) await prisma.viewerPaymentMethod.update({ where: { id: next.id }, data: { isDefault: true } });
  }
  return NextResponse.json({ success: true });
}
