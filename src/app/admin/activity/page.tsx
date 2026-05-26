import { requireAdminSession } from "@/lib/admin-auth";
import { AdminActivityClient } from "./admin-activity-client";

export default async function AdminActivityPage() {
  await requireAdminSession();
  return <AdminActivityClient />;
}
