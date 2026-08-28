import { requireAdminSession } from "@/lib/admin-auth";
import { Suspense } from "react";
import { AdminActivityClient } from "./admin-activity-client";
import { StoryTimeLoadingCenter } from "@/components/ui/storytime-loader";

export default async function AdminActivityPage() {
  await requireAdminSession();
  return (
    <Suspense fallback={<StoryTimeLoadingCenter />}>
      <AdminActivityClient />
    </Suspense>
  );
}
