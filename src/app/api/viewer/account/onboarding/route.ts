import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  completeViewerAccountOnboarding,
  loadViewerOnboardingState,
} from "@/lib/viewer-account-onboarding";

export async function GET() {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;
  const role = (session?.user as { role?: string })?.role;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (role !== "SUBSCRIBER" && role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const state = await loadViewerOnboardingState(userId);
  if (!state) return NextResponse.json({ error: "User not found" }, { status: 404 });
  return NextResponse.json(state);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;
  const role = (session?.user as { role?: string })?.role;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (role !== "SUBSCRIBER" && role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await req.json().catch(() => null)) as {
    name?: string;
    email?: string;
    phoneNumber?: string;
    residentialAddress?: string;
    city?: string;
    provinceState?: string;
    postalCode?: string;
    country?: string;
  } | null;

  if (!body?.name || !body?.email || !body?.phoneNumber) {
    return NextResponse.json({ error: "Name, email, and phone number are required." }, { status: 400 });
  }

  try {
    await completeViewerAccountOnboarding(userId, {
      name: body.name,
      email: body.email,
      phoneNumber: body.phoneNumber,
      residentialAddress: body.residentialAddress,
      city: body.city,
      provinceState: body.provinceState,
      postalCode: body.postalCode,
      country: body.country,
    });
    return NextResponse.json({ ok: true, redirectTo: "/profiles" });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not save account details." },
      { status: 400 },
    );
  }
}
