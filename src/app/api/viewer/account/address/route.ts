import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { loadViewerBillingAddress, upsertViewerBillingAddress } from "@/lib/user-settings-persistence";

export async function GET() {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;
  const role = (session?.user as { role?: string })?.role;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (role !== "SUBSCRIBER" && role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const address = await loadViewerBillingAddress(userId);
  return NextResponse.json({ address });
}

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;
  const role = (session?.user as { role?: string })?.role;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (role !== "SUBSCRIBER" && role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await req.json().catch(() => null)) as {
    residentialAddress?: string;
    city?: string;
    provinceState?: string;
    postalCode?: string;
    country?: string;
  } | null;

  if (!body) return NextResponse.json({ error: "Invalid payload." }, { status: 400 });

  try {
    await upsertViewerBillingAddress(userId, body);
    const address = await loadViewerBillingAddress(userId);
    return NextResponse.json({ ok: true, address });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not save address." },
      { status: 400 },
    );
  }
}
