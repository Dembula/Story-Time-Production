import { requireAdminSession } from "@/lib/admin-auth";
import { AdminScriptReviewsClient } from "./admin-script-reviews-client";

export default async function AdminScriptReviewsPage({
  searchParams,
}: {
  searchParams: Promise<{ requestId?: string }>;
}) {
  await requireAdminSession();
  const { requestId } = await searchParams;
  return <AdminScriptReviewsClient initialRequestId={requestId} />;
}
