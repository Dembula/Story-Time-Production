import { requireAdminSession } from "@/lib/admin-auth";
import { AdminCrewClient } from "./admin-crew-client";

export default async function AdminCrewPage() {
  await requireAdminSession();
  return <AdminCrewClient />;
}
