"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { useQuery } from "@tanstack/react-query";
import { PAYEE_DASHBOARD_REFETCH_MS } from "@/lib/dashboard-refresh";
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
    refetchInterval: PAYEE_DASHBOARD_REFETCH_MS,
  });

  const available = Number(data?.wallet?.availableBalance ?? 0);
  const role = (session?.user as { role?: string } | undefined)?.role;
  const walletHref = getWalletRouteForRole(role);

  return (
    <Link
      href={walletHref}
      className="inline-flex max-w-[7.5rem] shrink-0 items-center gap-1 truncate rounded-lg border border-emerald-800/60 bg-emerald-950/30 px-2 py-1.5 text-[11px] text-emerald-200 hover:bg-emerald-900/30 sm:max-w-none sm:px-2.5 sm:text-xs"
      title={`Wallet balance: R${currencyNumberFormat.format(available)}`}
    >
      <span className="hidden sm:inline">Wallet: </span>
      <span className="truncate">R{currencyNumberFormat.format(available)}</span>
    </Link>
  );
}
