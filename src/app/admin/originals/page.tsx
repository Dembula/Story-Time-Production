import { requireAdminSession } from "@/lib/admin-auth";
import { AdminOriginalsClient } from "./admin-originals-client";

export default async function AdminOriginalsPage() {
  await requireAdminSession();
  return <AdminOriginalsClient />;
}
