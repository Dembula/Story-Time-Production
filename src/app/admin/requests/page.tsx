import { requireAdminSession } from "@/lib/admin-auth";
import { AdminRequestsClient } from "./admin-requests-client";

export default async function AdminRequestsPage() {
  await requireAdminSession();
  return <AdminRequestsClient />;
}
