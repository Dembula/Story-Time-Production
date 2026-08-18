"use client";

import { LogOutButton } from "@/components/auth/log-out-button";

export function OnboardingExitBar({ className = "mb-8 flex justify-end" }: { className?: string }) {
  return (
    <div className={className}>
      <LogOutButton />
    </div>
  );
}
