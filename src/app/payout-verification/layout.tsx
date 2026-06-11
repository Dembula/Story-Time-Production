import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { requiresPayoutKyc } from "@/lib/payout-kyc";
import { signInUrlForDestination } from "@/lib/auth-sign-in-path";

export default async function PayoutVerificationLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect(signInUrlForDestination("/payout-verification"));

  const role = (session.user as { role?: string }).role;
  if (!requiresPayoutKyc(role)) redirect("/");

  return (
    <div className="min-h-screen bg-background px-6 py-10 text-slate-100">
      <div className="mx-auto max-w-4xl">{children}</div>
    </div>
  );
}
