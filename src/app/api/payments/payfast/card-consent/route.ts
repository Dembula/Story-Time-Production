import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isPayFastConfigured } from "@/lib/payments/config";
import { createPayFastCardConsentForUser } from "@/lib/payments/payfast-saved-card";
import { buildPaymentReturnUrl } from "@/lib/payments/return-url";

/** Any authenticated user (viewer or creator) can tokenize a card via PayFast. */
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const user = session?.user as { id?: string; email?: string | null; name?: string | null } | undefined;
  if (!user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!isPayFastConfigured()) {
    return NextResponse.json({ error: "PayFast is not configured." }, { status: 503 });
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
    return NextResponse.json({ ok: true, checkoutUrl: consent.checkoutUrl });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to start PayFast card setup.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
