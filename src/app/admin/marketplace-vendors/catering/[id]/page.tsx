import { requireAdminSession } from "@/lib/admin-auth";
import { AdminMarketplaceDossier } from "@/components/admin/admin-marketplace-dossier";

export default async function AdminCateringDossierPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdminSession();
  const { id } = await params;
  return <AdminMarketplaceDossier type="catering" id={id} />;
}
