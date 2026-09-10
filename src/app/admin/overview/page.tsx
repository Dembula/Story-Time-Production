import { requireAdminSession } from "@/lib/admin-auth";
import { AdminOverviewClient } from "../admin-overview-client";

/** Ops overview — reachable from the sidebar without bouncing seat holders off /admin. */
export default async function AdminOpsOverviewPage() {
  await requireAdminSession();
  return <AdminOverviewClient />;
}
