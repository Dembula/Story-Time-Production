import { Suspense } from "react";
import { Video } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { MeetGuestClient } from "@/components/meet/meet-guest-client";

export const dynamic = "force-dynamic";

export default async function PublicMeetGuestPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code: raw } = await params;
  const code = decodeURIComponent(raw).trim();
  const meeting = await prisma.meetMeeting.findFirst({
    where: {
      OR: [{ code }, { code: code.toUpperCase() }, { id: code }],
    },
    select: {
      id: true,
      code: true,
      title: true,
      status: true,
      passcode: true,
      waitingRoom: true,
    },
  });

  if (!meeting) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-[#0a0a0b] px-6 text-center">
        <Video className="h-10 w-10 text-slate-600" />
        <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-orange-300/85">
          Story Time Meet
        </p>
        <h1 className="text-lg font-semibold text-white">Meeting not found</h1>
        <p className="max-w-md text-sm text-slate-400">
          This guest link is invalid or the meeting was removed. Ask the host for a new invite.
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0b] text-white">
      <Suspense
        fallback={
          <div className="flex min-h-screen items-center justify-center text-slate-400">
            Loading Meet…
          </div>
        }
      >
        <MeetGuestClient
          code={meeting.code}
          meetingId={meeting.id}
          meetingTitle={meeting.title}
          ended={meeting.status === "ENDED" || meeting.status === "CANCELLED"}
          requiresPasscode={Boolean(meeting.passcode)}
          waitingRoom={meeting.waitingRoom}
        />
      </Suspense>
    </div>
  );
}
