import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getWalletRouteForRole } from "@/lib/wallet-route";

export default async function WalletLandingPage() {
  const session = await getServerSession(authOptions);
  const role = (session?.user as { role?: string } | undefined)?.role;
  redirect(getWalletRouteForRole(role));
}
