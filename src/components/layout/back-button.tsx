"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

export function BackButton({ fallback = "/" }: { fallback?: string }) {
  const router = useRouter();

  return (
    <button
      onClick={() => {
        if (window.history.length > 1) {
          router.back();
        } else {
          router.push(fallback);
        }
      }}
      className="inline-flex items-center gap-2 px-3 py-1.5 text-sm text-slate-400 hover:text-white rounded-lg hover:bg-slate-800/50 transition mb-4"
    >
      <ArrowLeft className="w-4 h-4" />
      Back
    </button>
  );
}
