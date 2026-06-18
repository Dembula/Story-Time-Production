"use client";

import { signOut } from "next-auth/react";
import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

type LogOutButtonProps = {
  label?: string;
  landingPath?: string;
  className?: string;
  showIcon?: boolean;
};

export function LogOutButton({
  label = "Log out",
  landingPath = "/",
  className = "",
  showIcon = true,
}: LogOutButtonProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleLogOut() {
    if (loading) return;
    setLoading(true);
    try {
      await signOut({ redirect: false });
      router.push(landingPath);
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={() => void handleLogOut()}
      disabled={loading}
      className={
        className ||
        "inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-slate-300 transition hover:border-red-400/30 hover:bg-red-500/10 hover:text-red-300 disabled:opacity-60"
      }
    >
      {showIcon ? <LogOut className="h-4 w-4" /> : null}
      {loading ? "Logging out…" : label}
    </button>
  );
}
