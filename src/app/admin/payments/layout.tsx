import { requireAdminSession } from "@/lib/admin-auth";

export default async function AdminPaymentsLayout({ children }: { children: React.ReactNode }) {
  await requireAdminSession();
  return children;
}
