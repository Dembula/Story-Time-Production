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
    <div className="min-h-screen bg-[radial-gradient(ellipse_at_top,_rgba(249,115,22,0.08),_transparent_45%),linear-gradient(180deg,#05070d_0%,#0a0f1a_100%)] px-4 py-8 text-slate-100 md:px-6 md:py-10">
      <div className="mx-auto max-w-4xl">{children}</div>
    </div>
  );
}
