import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { NotificationCenterClient } from "./notification-center-client";

export default async function NotificationsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect("/auth/signin");
  }
  const role = (session.user as { role?: string }).role ?? null;
  const backHref =
    role === "ADMIN"
      ? "/admin"
      : role === "CONTENT_CREATOR"
        ? "/creator/command-center"
        : role === "MUSIC_CREATOR"
          ? "/music-creator/dashboard"
          : role === "CREW_TEAM"
            ? "/crew-team/dashboard"
            : role === "LOCATION_OWNER"
              ? "/location-owner/dashboard"
              : role === "CATERING_COMPANY"
                ? "/catering-company/dashboard"
                : role === "EQUIPMENT_COMPANY"
                  ? "/equipment-company/dashboard"
                  : role === "CASTING_AGENCY"
                    ? "/casting-agency/dashboard"
                    : "/browse";
  return (
    <NotificationCenterClient
      role={role}
      backHref={backHref}
    />
  );
}

