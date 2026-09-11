import { requireAdminSession } from "@/lib/admin-auth";
import { AdminOverviewClient } from "./admin-overview-client";

export default async function AdminPage() {
  await requireAdminSession();
  return <AdminOverviewClient />;
}
