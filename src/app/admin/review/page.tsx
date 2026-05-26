import { requireAdminSession } from "@/lib/admin-auth";
import { AdminReviewHubClient } from "./admin-review-hub-client";

export default async function AdminReviewPage() {
  await requireAdminSession();
  return <AdminReviewHubClient />;
}
