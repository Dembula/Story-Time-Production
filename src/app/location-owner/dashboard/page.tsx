"use client";

import { StoryTimeLoader, StoryTimeLoadingCenter } from "@/components/ui/storytime-loader";
import { useEffect, useState } from "react";
import { LocationDashboardClient } from "./location-dashboard-client";

export default function LocationOwnerDashboardPage() {
  const [subChecked, setSubChecked] = useState(false);

  useEffect(() => {
    fetch("/api/company-subscription")
      .then((r) => r.json())
      .then((data) => {
        if (!data?.subscription?.id || data.subscription.status !== "ACTIVE") {
          window.location.href = "/company/onboarding/subscription";
          return;
        }
        setSubChecked(true);
      });
  }, []);

  if (!subChecked) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <StoryTimeLoader size="sm" hideTrack />
      </div>
    );
  }

  return <LocationDashboardClient />;
}
