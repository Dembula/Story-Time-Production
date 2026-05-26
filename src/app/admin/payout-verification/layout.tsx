import { requireAdminSession } from "@/lib/admin-auth";

export default async function AdminPayoutVerificationLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireAdminSession();
  return children;
}
