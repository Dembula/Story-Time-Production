import { requireAdminSession } from "@/lib/admin-auth";
import { AdminContentClient } from "./admin-content-client";

export default async function AdminContentPage() {
  await requireAdminSession();
  return <AdminContentClient />;
}
