import { requireAdminSession } from "@/lib/admin-auth";
import { AdminMarketplaceDossier } from "@/components/admin/admin-marketplace-dossier";

export default async function AdminCrewDossierPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdminSession();
  const { id } = await params;
  return <AdminMarketplaceDossier type="crew" id={id} />;
}
