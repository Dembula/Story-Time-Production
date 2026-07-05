import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isPayFastConfigured } from "@/lib/payments/config";
import { getPayFastCardUpdateUrlForUser } from "@/lib/payments/payfast-saved-card";

/** Redirect authenticated users to PayFast to update a saved card token. */
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const user = session?.user as { id?: string } | undefined;
  if (!user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!isPayFastConfigured()) {
    return NextResponse.json({ error: "PayFast is not configured. Card updates require live PayFast integration." }, { status: 503 });
  }

  const body = (await req.json().catch(() => null)) as {
    paymentMethodId?: string;
    returnPath?: string;
  } | null;

  try {
    const result = await getPayFastCardUpdateUrlForUser({
      userId: user.id,
      paymentMethodId: body?.paymentMethodId,
      returnPath: body?.returnPath,
    });
    return NextResponse.json({
      ok: true,
      updateUrl: result.updateUrl,
      message: "You will be redirected to PayFast to update your card securely.",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to start PayFast card update.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
