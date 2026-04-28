"use client";

import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatZar } from "@/lib/format-currency-zar";

type MarketplacePayload = {
  listedAssets: Array<{
    id: string;
    title: string;
    synopsis: string | null;
    themes: string | null;
    genre: string | null;
    listingPrice: number | null;
    listingCurrency: string;
    currentOwner: { name: string | null; professionalName: string | null };
  }>;
  myAssets: Array<{
    id: string;
    title: string;
    status: string;
    monetizationModel: string;
    listingPrice: number | null;
    creatorScript: { title: string } | null;
  }>;
  purchased: Array<{
    id: string;
    type: string;
    amount: number;
    date: string;
    ipAsset: { title: string };
    seller: { name: string | null; professionalName: string | null };
  }>;
  sold: Array<{
    id: string;
    type: string;
    amount: number;
    date: string;
    ipAsset: { title: string };
    buyer: { name: string | null; professionalName: string | null };
  }>;
};

export default function IpMarketplacePage() {
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["ip-marketplace-dashboard"],
    queryFn: () => fetch("/api/creator/ip-marketplace").then((r) => r.json() as Promise<MarketplacePayload>),
  });

  const purchaseMutation = useMutation({
    mutationFn: async (ipAssetId: string) => {
      const res = await fetch("/api/creator/ip-marketplace/purchase", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ipAssetId }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((json as { error?: string }).error || "Purchase failed");
      return json;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["ip-marketplace-dashboard"] });
      void queryClient.invalidateQueries({ queryKey: ["creator-scripts"] });
    },
  });

  const listedAssets = data?.listedAssets ?? [];
  const myAssets = data?.myAssets ?? [];
  const purchased = data?.purchased ?? [];
  const sold = data?.sold ?? [];

  const activeListings = useMemo(() => myAssets.filter((a) => a.status === "LISTED"), [myAssets]);

  return (
    <div className="space-y-4">
      <header className="storytime-plan-card p-5 md:p-6">
        <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.22em] text-orange-300/80">
          Creator Dashboard
        </p>
        <h2 className="font-display text-2xl font-semibold tracking-tight text-white md:text-[1.65rem]">
          Script IP Marketplace
        </h2>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-400">
          Discover scripts, buy listed IP, and track your sold and purchased history.
        </p>
      </header>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card className="creator-glass-panel border-0 bg-transparent text-slate-50 shadow-none xl:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Marketplace listings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-xs text-slate-300">
            {isLoading ? (
              <p className="text-slate-500">Loading marketplace…</p>
            ) : listedAssets.length === 0 ? (
              <p className="text-slate-500">No scripts listed right now.</p>
            ) : (
              listedAssets.map((asset) => (
                <div key={asset.id} className="rounded-lg border border-slate-800 bg-slate-900/60 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-slate-100">{asset.title}</p>
                      <p className="text-[11px] text-slate-500">
                        {asset.genre || "Unspecified genre"} · by{" "}
                        {asset.currentOwner.professionalName || asset.currentOwner.name || "Creator"}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      className="bg-orange-500 hover:bg-orange-600 text-white text-xs"
                      disabled={purchaseMutation.isPending}
                      onClick={() => purchaseMutation.mutate(asset.id)}
                    >
                      {purchaseMutation.isPending ? "Processing…" : `Buy ${formatZar(asset.listingPrice ?? 0)}`}
                    </Button>
                  </div>
                  <p className="mt-2 text-xs text-slate-300 line-clamp-3">
                    {asset.synopsis || "No synopsis provided."}
                  </p>
                  {asset.themes ? <p className="mt-1 text-[11px] text-slate-400">Themes: {asset.themes}</p> : null}
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card className="creator-glass-panel border-0 bg-transparent text-slate-50 shadow-none">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Ownership snapshot</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-xs text-slate-300">
            <p>Total owned assets: <span className="text-slate-100">{myAssets.length}</span></p>
            <p>Currently listed: <span className="text-slate-100">{activeListings.length}</span></p>
            <p>Purchased: <span className="text-slate-100">{purchased.length}</span></p>
            <p>Sold: <span className="text-slate-100">{sold.length}</span></p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Card className="creator-glass-panel border-0 bg-transparent text-slate-50 shadow-none">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Purchase history</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-xs text-slate-300">
            {purchased.length === 0 ? (
              <p className="text-slate-500">No purchased scripts yet.</p>
            ) : purchased.map((row) => (
              <div key={row.id} className="rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-2">
                <p className="font-medium text-slate-100">{row.ipAsset.title}</p>
                <p className="text-[11px] text-slate-500">
                  {formatZar(row.amount)} · from {row.seller.professionalName || row.seller.name || "Creator"} ·{" "}
                  {new Date(row.date).toLocaleDateString()}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="creator-glass-panel border-0 bg-transparent text-slate-50 shadow-none">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Sales history</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-xs text-slate-300">
            {sold.length === 0 ? (
              <p className="text-slate-500">No script sales yet.</p>
            ) : sold.map((row) => (
              <div key={row.id} className="rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-2">
                <p className="font-medium text-slate-100">{row.ipAsset.title}</p>
                <p className="text-[11px] text-slate-500">
                  {formatZar(row.amount)} · to {row.buyer.professionalName || row.buyer.name || "Creator"} ·{" "}
                  {new Date(row.date).toLocaleDateString()}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
