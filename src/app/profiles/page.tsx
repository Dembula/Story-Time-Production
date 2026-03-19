import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ProfilesClient } from "./profiles-client";

export default async function ProfilesPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/auth/signin");

  const role = (session.user as { role?: string }).role;
  if (role === "ADMIN") redirect("/admin");
  if (role === "CONTENT_CREATOR") redirect("/creator/dashboard");
  if (role === "MUSIC_CREATOR") redirect("/music-creator/dashboard");
  if (role && role !== "SUBSCRIBER") redirect("/browse");

  const profiles =
    "viewerProfile" in prisma && prisma.viewerProfile
      ? await prisma.viewerProfile.findMany({
          where: { userId: session.user.id },
          orderBy: { createdAt: "asc" },
          select: { id: true, name: true, age: true, updatedAt: true },
        })
      : [];

  return (
    <div className="min-h-screen bg-background px-6 py-16 text-slate-100">
      <div className="max-w-4xl mx-auto">
        <ProfilesClient initialProfiles={profiles} />
      </div>
    </div>
  );
}

