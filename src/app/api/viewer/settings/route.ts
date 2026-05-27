import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { cookies } from "next/headers";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getViewerProfileAge } from "@/lib/viewer-profiles";
import { loadViewerBillingAddress } from "@/lib/user-settings-persistence";

const ACTIVE_PROFILE_COOKIE = "st_viewer_profile";

function canAccessViewerSettings(role?: string | null): boolean {
  return role === "SUBSCRIBER" || role === "ADMIN";
}

export async function GET() {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;
  const role = (session?.user as { role?: string })?.role;

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!canAccessViewerSettings(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const warnings: string[] = [];

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      phoneNumber: true,
      accountOnboardingCompletedAt: true,
    },
  });
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  let preferences: { notifyEmail: boolean; playbackQuality: string | null };
  try {
    const prefs = await prisma.userPreference.upsert({
      where: { userId },
      create: { userId },
      update: {},
    });
    preferences = {
      notifyEmail: prefs.notifyEmail,
      playbackQuality: prefs.playbackQuality ?? "auto",
    };
  } catch (error) {
    console.error("GET /api/viewer/settings preferences", error);
    warnings.push("Notification preferences could not be loaded.");
    preferences = { notifyEmail: true, playbackQuality: "auto" };
  }

  let address: {
    residentialAddress: string;
    city: string;
    provinceState: string;
    postalCode: string;
    country: string;
  } = {
    residentialAddress: "",
    city: "",
    provinceState: "",
    postalCode: "",
    country: "South Africa",
  };
  try {
    const loaded = await loadViewerBillingAddress(userId);
    address = {
      residentialAddress: loaded.residentialAddress ?? "",
      city: loaded.city ?? "",
      provinceState: loaded.provinceState ?? "",
      postalCode: loaded.postalCode ?? "",
      country: loaded.country?.trim() || "South Africa",
    };
  } catch (error) {
    console.error("GET /api/viewer/settings address", error);
    warnings.push("Billing address could not be loaded.");
  }

  let paymentMethods: Array<{
    id: string;
    label: string;
    lastFour: string;
    isDefault: boolean;
  }> = [];
  try {
    paymentMethods = await prisma.viewerPaymentMethod.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      select: { id: true, label: true, lastFour: true, isDefault: true },
    });
  } catch (error) {
    console.error("GET /api/viewer/settings payment methods", error);
    warnings.push("Payment methods could not be loaded.");
  }

  type ProfileRow = {
    id: string;
    name: string;
    age: number;
    dateOfBirth: string | null;
    pinEnabled: boolean;
  };
  let profiles: ProfileRow[] = [];
  let activeProfileId: string | null = null;

  const profileDelegate =
    "viewerProfile" in prisma && prisma.viewerProfile ? prisma.viewerProfile : null;

  if (!profileDelegate) {
    warnings.push("Profiles are unavailable. Run database migrations and npx prisma generate.");
  } else {
    try {
      const rows = await profileDelegate.findMany({
        where: { userId },
        orderBy: { createdAt: "asc" },
        select: { id: true, name: true, age: true, dateOfBirth: true, pinEnabled: true },
      });
      profiles = rows.map((p) => ({
        id: p.id,
        name: p.name,
        age: getViewerProfileAge(p) ?? p.age,
        dateOfBirth: p.dateOfBirth?.toISOString() ?? null,
        pinEnabled: p.pinEnabled,
      }));

      const cookieStore = await cookies();
      const cookieProfileId = cookieStore.get(ACTIVE_PROFILE_COOKIE)?.value;
      if (cookieProfileId && profiles.some((p) => p.id === cookieProfileId)) {
        activeProfileId = cookieProfileId;
      }
    } catch (error) {
      console.error("GET /api/viewer/settings profiles", error);
      warnings.push("Profiles could not be loaded.");
    }
  }

  let subscription: {
    id: string;
    plan: string;
    viewerModel: string;
    deviceCount: number;
    profileLimit: number | null;
    status: string;
  } | null = null;
  try {
    const sub = await prisma.viewerSubscription.findFirst({
      where: { userId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        plan: true,
        viewerModel: true,
        deviceCount: true,
        profileLimit: true,
        status: true,
      },
    });
    if (sub) {
      subscription = sub;
    }
  } catch (error) {
    console.error("GET /api/viewer/settings subscription", error);
    warnings.push("Subscription details could not be loaded.");
  }

  return NextResponse.json({
    account: {
      name: user.name ?? "",
      email: user.email ?? "",
      phoneNumber: user.phoneNumber ?? "",
      onboardingComplete: Boolean(user.accountOnboardingCompletedAt),
    },
    address,
    preferences,
    paymentMethods,
    profiles,
    activeProfileId,
    subscription,
    warnings,
  });
}
