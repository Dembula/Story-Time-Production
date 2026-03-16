"use client";

import { useEffect, useState } from "react";
import { DollarSign, CreditCard } from "lucide-react";

export function CateringRevenueClient() {
  const [revenue, setRevenue] = useState(0);
  const [transactions, setTransactions] = useState<{ id: string; amount: number; totalAmount: number; createdAt: string }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/catering-company/stats").then((r) => r.json()),
      fetch("/api/catering-company/transactions").then((r) => r.json()),
    ]).then(([stats, txs]) => {
      setRevenue(stats.revenue ?? 0);
      setTransactions(Array.isArray(txs) ? txs : []);
    }).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="p-8 flex justify-center"><div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-8">
      <h1 className="text-3xl font-semibold text-white mb-2 flex items-center gap-3"><DollarSign className="w-8 h-8 text-orange-500" /> Revenue & banking</h1>
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-5">
          <p className="text-xs text-slate-400 mb-1">Total revenue (ZAR)</p>
          <p className="text-2xl font-bold text-white">R{revenue.toFixed(2)}</p>
          <p className="text-xs text-slate-500 mt-1">From completed bookings after 3% platform fee</p>
        </div>
      </div>
      <div className="rounded-2xl bg-slate-800/30 border border-slate-700/50 p-6">
        <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2"><CreditCard className="w-5 h-5 text-slate-400" /> Transactions</h2>
        {transactions.length === 0 ? (
          <p className="text-slate-500 text-sm">No transactions yet.</p>
        ) : (
          <ul className="space-y-2">
            {transactions.map((t) => (
              <li key={t.id} className="flex justify-between py-2 border-b border-slate-700/30 last:border-0">
                <span className="text-white">R{t.amount.toFixed(2)}</span>
                <span className="text-slate-500 text-sm">{new Date(t.createdAt).toLocaleDateString()}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
