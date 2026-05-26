import { requireAdminSession } from "@/lib/admin-auth";
import { AdminCastClient } from "./admin-cast-client";

export default async function AdminCastPage() {
  await requireAdminSession();
  return <AdminCastClient />;
}
