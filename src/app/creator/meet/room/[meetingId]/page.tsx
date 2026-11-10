import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { MeetRoomLauncher } from "@/components/meet/meet-room-launcher";

export const dynamic = "force-dynamic";

export default async function CreatorMeetRoomPage({
  params,
}: {
  params: Promise<{ meetingId: string }>;
}) {
  const { meetingId } = await params;
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) redirect("/auth/signin");

  const meeting = await prisma.meetMeeting.findFirst({
    where: {
      OR: [{ id: meetingId }, { code: meetingId }],
    },
  });
  if (!meeting) {
    return (
      <div className="p-8 text-center text-slate-300">
        Meeting not found.{" "}
        <a href="/creator/meet" className="text-emerald-400 underline">
          Back to Meet
        </a>
      </div>
    );
  }

  return (
    <MeetRoomLauncher
      meetingId={meeting.id}
      title={meeting.title}
      code={meeting.code}
      displayName={session?.user?.name || "You"}
    />
  );
}
