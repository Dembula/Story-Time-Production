import { requireAdminSession } from "@/lib/admin-auth";
import { AdminContentDossierClient } from "@/components/admin/admin-content-dossier-client";

export default async function AdminContentDetailPage() {
  await requireAdminSession();
  return <AdminContentDossierClient />;
}
