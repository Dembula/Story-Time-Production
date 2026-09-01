import { AdminPayoutRequestsPanel } from "@/components/admin/admin-payout-requests-panel";

export default function AdminFinancialPage() {
  return (
    <div className="space-y-6 text-slate-100">
      <header className="storytime-plan-card p-5 md:p-6">
        <h1 className="text-2xl font-semibold text-white">Financial — creator payouts</h1>
        <p className="mt-2 max-w-3xl text-sm text-slate-400">
          Review creator withdrawal requests, confirm the linked bank account, approve payouts, and mark them paid with
          proof of payment for the creator&apos;s wallet.
        </p>
      </header>
      <AdminPayoutRequestsPanel />
    </div>
  );
}
