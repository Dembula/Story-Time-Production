import { requireAdminSession } from "@/lib/admin-auth";
import { AdminEncodeHealthClient } from "./admin-encode-health-client";

export default async function AdminEncodeHealthPage() {
  await requireAdminSession();
  return <AdminEncodeHealthClient />;
}
