import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { AdminMusicClient } from "./admin-music-client";

export default async function AdminMusicPage() {
  const session = await getServerSession(authOptions);
  const role = (session?.user as { role?: string })?.role;
  if (!session || role !== "ADMIN") redirect("/auth/signin");

  return <AdminMusicClient />;
}
