"use client";

import { LogOutButton } from "@/components/auth/log-out-button";

export function OnboardingExitBar() {
  return (
    <div className="mb-8 flex justify-end">
      <LogOutButton />
    </div>
  );
}
