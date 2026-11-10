import Link from "next/link";
import { MeetJoinByCodeClient } from "@/components/meet/meet-join-by-code-client";

export const dynamic = "force-dynamic";

/** Fallback only — invite emails use /meet/{code} so guests never need this screen. */
export default function PublicMeetJoinPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#1b1a19] px-4 py-12">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/st-mark.png" alt="" className="mx-auto h-8 w-auto object-contain opacity-90" />
          <p className="mt-3 text-[10px] font-semibold uppercase tracking-[0.22em] text-orange-300/85">
            Story Time Meet
          </p>
          <h1 className="mt-3 font-display text-3xl font-semibold text-white">Join with a code</h1>
          <p className="mt-2 text-sm leading-relaxed text-slate-400">
            Got an invite email? Tap <span className="text-slate-200">Join now</span> in that message
            instead — the meeting is already in the link. Use this page only if someone gave you a
            code separately.
          </p>
        </div>
        <MeetJoinByCodeClient />
        <p className="text-center text-xs text-slate-500">
          Prefer the lobby link from your invite, or{" "}
          <Link href="/" className="text-orange-300 hover:underline">
            go home
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
