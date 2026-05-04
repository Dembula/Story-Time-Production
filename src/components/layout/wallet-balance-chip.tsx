"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { useQuery } from "@tanstack/react-query";
import { getWalletRouteForRole } from "@/lib/wallet-route";

const currencyNumberFormat = new Intl.NumberFormat("en-ZA", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function WalletBalanceChip() {
  const { data: session } = useSession();
  const { data } = useQuery({
    queryKey: ["wallet-chip-balance"],
    queryFn: async () => {
      const res = await fetch("/api/wallet");
      if (!res.ok) return null;
      return res.json().catch(() => null);
    },
    refetchInterval: 15000,
  });

  const available = Number(data?.wallet?.availableBalance ?? 0);
  const role = (session?.user as { role?: string } | undefined)?.role;
  const walletHref = getWalletRouteForRole(role);

  return (
    <Link
      href={walletHref}
      className="inline-flex items-center gap-1 rounded-lg border border-emerald-800/60 bg-emerald-950/30 px-2.5 py-1.5 text-xs text-emerald-200 hover:bg-emerald-900/30"
    >
      Wallet: R{currencyNumberFormat.format(available)}
    </Link>
  );
}
