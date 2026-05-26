import { requireAdminSession } from "@/lib/admin-auth";

export default async function AdminFundersLayout({ children }: { children: React.ReactNode }) {
  await requireAdminSession();
  return children;
}
