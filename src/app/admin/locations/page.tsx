import { requireAdminSession } from "@/lib/admin-auth";
import { AdminLocationsClient } from "./admin-locations-client";

export default async function AdminLocationsPage() {
  await requireAdminSession();
  return <AdminLocationsClient />;
}
