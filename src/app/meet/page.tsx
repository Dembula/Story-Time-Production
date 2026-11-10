import Link from "next/link";
import { MeetJoinByCodeClient } from "@/components/meet/meet-join-by-code-client";

export const dynamic = "force-dynamic";

export default function PublicMeetJoinPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0a0a0b] px-4 py-12">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-orange-300/85">
            Story Time Meet
          </p>
          <h1 className="mt-3 font-display text-3xl font-semibold text-white">Join a meeting</h1>
          <p className="mt-2 text-sm text-slate-400">
            Enter the meeting code from your invite email. Guests don’t need an account.
          </p>
        </div>
        <MeetJoinByCodeClient />
        <p className="text-center text-xs text-slate-500">
          Have a direct link? Open it from your invite, or{" "}
          <Link href="/" className="text-orange-300 hover:underline">
            go home
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
