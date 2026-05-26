import { requireAdminSession } from "@/lib/admin-auth";
import { AdminScriptReviewsClient } from "./admin-script-reviews-client";

export default async function AdminScriptReviewsPage() {
  await requireAdminSession();
  return <AdminScriptReviewsClient />;
}
