import { requireAdminSession } from "@/lib/admin-auth";
import { AdminMusicClient } from "./admin-music-client";

export default async function AdminMusicPage() {
  await requireAdminSession();
  return <AdminMusicClient />;
}
