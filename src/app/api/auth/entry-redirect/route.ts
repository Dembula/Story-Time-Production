import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { defaultHomeForRole } from "@/lib/auth-sign-in-path";
import { getCreatorPackageStatus } from "@/lib/creator-package-gate";
import {
  getLatestViewerSubscription,
  getViewerModel,
  subscriptionNeedsReactivation,
} from "@/lib/viewer-access";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const role = (session.user as { role?: string }).role;

  if (role === "SUBSCRIBER") {
    const subscription = await getLatestViewerSubscription(session.user.id);
    if (!subscription) {
      return NextResponse.json({ path: "/onboarding/package" });
    }
    if (getViewerModel(subscription) === "SUBSCRIPTION" && subscriptionNeedsReactivation(subscription)) {
      return NextResponse.json({ path: "/profiles?payment=required" });
    }
    return NextResponse.json({ path: "/profiles" });
  }

  if (role === "CONTENT_CREATOR" || role === "MUSIC_CREATOR") {
    const status = await getCreatorPackageStatus(session.user.id, role);
    if (!status.complete) {
      return NextResponse.json({ path: status.onboardingPath });
    }
    return NextResponse.json({ path: defaultHomeForRole(role) });
  }

  return NextResponse.json({ path: defaultHomeForRole(role) });
}
