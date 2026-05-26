import { requireAdminSession } from "@/lib/admin-auth";

export default async function AdminPromoCodesLayout({ children }: { children: React.ReactNode }) {
  await requireAdminSession();
  return children;
}
