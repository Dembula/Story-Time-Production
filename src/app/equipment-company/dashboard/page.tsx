"use client";

import { useEffect, useState } from "react";
import { EquipmentDashboardClient } from "./equipment-dashboard-client";

export default function EquipmentDashboardPage() {
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
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-cyan-500 border-t-transparent" />
      </div>
    );
  }

  return <EquipmentDashboardClient />;
}
