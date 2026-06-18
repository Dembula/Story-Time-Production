"use client";

import { useQuery } from "@tanstack/react-query";
import { X, Loader2, ArrowRight, Building2, User, Wallet, FileText, Radio } from "lucide-react";
import { formatZar } from "@/lib/format-currency-zar";
import type {
  AdminMarketplaceTransactionDetail,
  AdminPaymentRecordDetail,
} from "@/lib/admin/payment-transaction-detail";

type DetailKind = "payment" | "marketplace";

export function AdminTransactionDetailModal({
  kind,
  id,
  onClose,
}: {
  kind: DetailKind | null;
  id: string | null;
  onClose: () => void;
}) {
  const { data, isLoading, error } = useQuery({
    queryKey: ["admin-payment-detail", kind, id],
    enabled: Boolean(kind && id),
    queryFn: async () => {
      const res = await fetch(
        `/api/admin/payments/detail?kind=${encodeURIComponent(kind!)}&id=${encodeURIComponent(id!)}`,
        { cache: "no-store" },
      );
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || "Failed to load transaction detail.");
      return json.detail as AdminPaymentRecordDetail | AdminMarketplaceTransactionDetail;
    },
  });

  if (!kind || !id) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-0 sm:items-center sm:p-4">
      <div
        role="dialog"
        aria-modal="true"
        className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-t-2xl border border-white/10 bg-slate-950 shadow-2xl sm:rounded-2xl"
      >
        <div className="flex items-start justify-between gap-4 border-b border-white/10 px-5 py-4">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-orange-300/80">Transaction detail</p>
            <h2 className="mt-1 text-lg font-semibold text-white">
              {kind === "payment" ? "Gateway payment" : "Marketplace transaction"}
            </h2>
            <p className="mt-1 break-all font-mono text-xs text-slate-500">{id}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-700 p-2 text-slate-400 hover:bg-slate-900 hover:text-white"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {isLoading ? (
            <div className="flex items-center justify-center gap-2 py-16 text-slate-400">
              <Loader2 className="h-5 w-5 animate-spin" />
              Loading transaction…
            </div>
          ) : null}

          {error ? (
            <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
              {error instanceof Error ? error.message : "Unable to load detail."}
            </p>
          ) : null}

          {data?.kind === "payment_record" ? <PaymentRecordDetail detail={data} /> : null}
          {data?.kind === "marketplace_transaction" ? <MarketplaceTransactionDetail detail={data} /> : null}
        </div>
      </div>
    </div>
  );
}

function Section({ title, icon, children }: { title: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
      <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-white">
        {icon}
        {title}
      </h3>
      {children}
    </section>
  );
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="grid gap-1 border-b border-slate-800/80 py-2 last:border-0 sm:grid-cols-[160px_1fr]">
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className="text-sm text-slate-200 break-words">{value}</dd>
    </div>
  );
}

function PartyCard({
  title,
  user,
}: {
  title: string;
  user: { id: string; name: string | null; email: string | null; role: string | null } | null;
}) {
  if (!user) return <p className="text-sm text-slate-500">Not linked to a user account.</p>;
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-3">
      <p className="text-[11px] uppercase tracking-wide text-slate-500">{title}</p>
      <p className="mt-1 font-medium text-white">{user.name || "—"}</p>
      <p className="text-sm text-slate-400">{user.email || "—"}</p>
      <p className="mt-1 text-xs text-orange-300/90">{user.role || "—"}</p>
      <p className="mt-2 font-mono text-[10px] text-slate-600">{user.id}</p>
    </div>
  );
}

function RevenueRoutingTable({
  category,
  lines,
}: {
  category: string;
  lines: AdminPaymentRecordDetail["revenueRouting"];
}) {
  return (
    <div className="space-y-3">
      <p className="text-xs text-slate-400">{category}</p>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[520px] text-left text-xs">
          <thead>
            <tr className="border-b border-slate-800 text-slate-500">
              <th className="pb-2 pr-3 font-medium">Allocation</th>
              <th className="pb-2 pr-3 font-medium">Recipient</th>
              <th className="pb-2 pr-3 font-medium">Wallet account</th>
              <th className="pb-2 font-medium text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((line) => (
              <tr key={`${line.label}-${line.accountType}`} className="border-b border-slate-800/60">
                <td className="py-2 pr-3 text-slate-200">
                  <p>{line.label}</p>
                  <p className="mt-0.5 text-[10px] text-slate-500">{line.description}</p>
                </td>
                <td className="py-2 pr-3 text-slate-300">
                  <p>{line.recipient}</p>
                  {line.recipientRole ? <p className="text-[10px] text-slate-500">{line.recipientRole}</p> : null}
                </td>
                <td className="py-2 pr-3 font-mono text-slate-400">{line.accountType}</td>
                <td className="py-2 text-right font-semibold text-white">{formatZar(line.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function PaymentRecordDetail({ detail }: { detail: AdminPaymentRecordDetail }) {
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-3">
          <p className="text-[11px] uppercase text-slate-500">Status</p>
          <p className="mt-1 text-sm font-semibold text-white">{detail.status}</p>
        </div>
        <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-3">
          <p className="text-[11px] uppercase text-slate-500">Customer paid</p>
          <p className="mt-1 text-lg font-semibold text-white">{formatZar(detail.amount)}</p>
        </div>
        <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-3">
          <p className="text-[11px] uppercase text-slate-500">PayFast fee</p>
          <p className="mt-1 text-lg font-semibold text-red-300">
            {detail.providerFeeAmount != null ? formatZar(detail.providerFeeAmount) : "—"}
          </p>
        </div>
        <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-3">
          <p className="text-[11px] uppercase text-slate-500">Net settled</p>
          <p className="mt-1 text-lg font-semibold text-emerald-300">
            {formatZar(detail.settlementAmount ?? detail.amount)}
          </p>
        </div>
        <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-3">
          <p className="text-[11px] uppercase text-slate-500">Payment method</p>
          <p className="mt-1 text-sm font-semibold text-white">{detail.providerPaymentMethodLabel || "—"}</p>
          {detail.settlementSource ? (
            <p className="mt-0.5 text-[10px] text-slate-500">via {detail.settlementSource}</p>
          ) : null}
        </div>
      </div>

      <Section title="What this payment was for" icon={<FileText className="h-4 w-4 text-orange-400" />}>
        <dl>
          <DetailRow label="Purpose code" value={<code className="text-orange-200">{detail.purpose}</code>} />
          <DetailRow label="Description" value={detail.purposeLabel} />
          <DetailRow label="Related entity" value={detail.relatedEntity.summary || "—"} />
          {detail.relatedEntity.type ? (
            <DetailRow
              label="Entity reference"
              value={`${detail.relatedEntity.type} · ${detail.relatedEntity.id}`}
            />
          ) : null}
          {detail.relatedEntity.extra ? (
            <DetailRow
              label="Entity details"
              value={
                <pre className="overflow-x-auto rounded bg-slate-950 p-2 text-[11px] text-slate-400">
                  {JSON.stringify(detail.relatedEntity.extra, null, 2)}
                </pre>
              }
            />
          ) : null}
        </dl>
      </Section>

      <Section title="Accounts involved" icon={<User className="h-4 w-4 text-orange-400" />}>
        <div className="grid gap-3 sm:grid-cols-2">
          <PartyCard title="Payer / subscriber" user={detail.payer} />
          <div className="rounded-lg border border-orange-500/20 bg-orange-500/5 p-3">
            <p className="text-[11px] uppercase tracking-wide text-orange-300/80">Platform recipient</p>
            <p className="mt-1 flex items-center gap-2 font-medium text-white">
              <Building2 className="h-4 w-4 text-orange-400" />
              Story Time (Pty) Ltd treasury
            </p>
            <p className="mt-1 text-xs text-slate-400">PayFast settles to platform merchant account, then ledger splits apply.</p>
          </div>
        </div>
      </Section>

      <Section title="Where the money goes" icon={<ArrowRight className="h-4 w-4 text-orange-400" />}>
        <RevenueRoutingTable category={detail.revenueCategory} lines={detail.revenueRouting} />
      </Section>

      {detail.ledgerBatch ? (
        <Section title="Ledger entries (actual booking)" icon={<Wallet className="h-4 w-4 text-orange-400" />}>
          <p className="mb-2 text-xs text-slate-500">
            Batch <span className="font-mono">{detail.ledgerBatch.idempotencyKey}</span> · {detail.ledgerBatch.status}
          </p>
          <div className="space-y-2">
            {detail.ledgerBatch.entries.map((e, i) => (
              <div key={i} className="rounded-lg border border-slate-800 px-3 py-2 text-xs">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium text-white">
                    {e.direction} · {e.accountType}
                  </span>
                  <span className="font-semibold text-emerald-300">{formatZar(e.amount)}</span>
                </div>
                <p className="mt-1 text-slate-400">{e.description || e.transactionType}</p>
                <p className="mt-1 text-[10px] text-slate-500">{e.userLabel}</p>
              </div>
            ))}
          </div>
        </Section>
      ) : null}

      {detail.subscriptionPayment ? (
        <Section title="Subscription payment link" icon={<FileText className="h-4 w-4 text-orange-400" />}>
          <dl>
            <DetailRow label="Subscription payment ID" value={detail.subscriptionPayment.id} />
            <DetailRow label="Purpose" value={detail.subscriptionPayment.purpose} />
            <DetailRow label="Status" value={detail.subscriptionPayment.status} />
            <DetailRow label="Amount" value={formatZar(detail.subscriptionPayment.amount)} />
            <DetailRow
              label="Paid at"
              value={
                detail.subscriptionPayment.paidAt
                  ? new Date(detail.subscriptionPayment.paidAt).toLocaleString()
                  : "—"
              }
            />
          </dl>
        </Section>
      ) : null}

      <Section title="Gateway & PayFast" icon={<Radio className="h-4 w-4 text-orange-400" />}>
        <dl>
          <DetailRow label="Gateway reference" value={detail.gatewayReference || "—"} />
          <DetailRow label="PayFast payment ID" value={detail.providerPaymentId || "—"} />
          <DetailRow label="PayFast payment method" value={detail.providerPaymentMethodLabel || detail.providerPaymentMethod || "—"} />
          <DetailRow
            label="PayFast fee"
            value={detail.providerFeeAmount != null ? formatZar(detail.providerFeeAmount) : "—"}
          />
          <DetailRow
            label="Net settlement"
            value={formatZar(detail.settlementAmount ?? detail.amount)}
          />
          <DetailRow label="Settlement source" value={detail.settlementSource || "—"} />
          <DetailRow label="Provider" value={detail.provider} />
          <DetailRow label="ITN status" value={detail.providerItnStatus || "—"} />
          <DetailRow label="Paid at" value={detail.paidAt ? new Date(detail.paidAt).toLocaleString() : "—"} />
          <DetailRow label="Created" value={new Date(detail.createdAt).toLocaleString()} />
        </dl>
        {detail.gatewayReferences.length > 0 ? (
          <div className="mt-3 space-y-1">
            <p className="text-xs text-slate-500">Gateway references</p>
            {detail.gatewayReferences.map((g) => (
              <p key={g.id} className="font-mono text-[11px] text-slate-400">
                {g.externalRef} · {g.referenceType}/{g.referenceId}
              </p>
            ))}
          </div>
        ) : null}
        {detail.gatewayEvents.length > 0 ? (
          <div className="mt-3 space-y-1">
            <p className="text-xs text-slate-500">Gateway events</p>
            {detail.gatewayEvents.map((g) => (
              <p key={g.id} className="text-[11px] text-slate-400">
                {g.eventType} · {g.signatureVerified ? "verified" : "unverified"} ·{" "}
                {g.processed ? "processed" : "pending"} · {new Date(g.createdAt).toLocaleString()}
              </p>
            ))}
          </div>
        ) : null}
        {detail.webhookEvents.length > 0 ? (
          <div className="mt-3 space-y-1">
            <p className="text-xs text-slate-500">PayFast ITN webhooks</p>
            {detail.webhookEvents.map((w) => (
              <p key={w.id} className="text-[11px] text-slate-400">
                {w.eventType} · {w.signatureVerified ? "verified" : "unverified"} ·{" "}
                {w.processedAt ? "processed" : w.processingError || "pending"}
              </p>
            ))}
          </div>
        ) : null}
      </Section>

      {detail.invoice ? (
        <Section title="Invoice" icon={<FileText className="h-4 w-4 text-orange-400" />}>
          <dl>
            <DetailRow label="Invoice #" value={detail.invoice.invoiceNumber} />
            <DetailRow label="Status" value={detail.invoice.status} />
            <DetailRow label="Subtotal" value={formatZar(detail.invoice.subtotalAmount)} />
            <DetailRow label="Platform fee line" value={formatZar(detail.invoice.platformFeeAmount)} />
            <DetailRow label="Total" value={formatZar(detail.invoice.totalAmount)} />
          </dl>
          {detail.invoice.lines.length > 0 ? (
            <ul className="mt-3 space-y-1 text-xs text-slate-400">
              {detail.invoice.lines.map((l, i) => (
                <li key={i}>
                  {l.description} ×{l.quantity} — {formatZar(l.totalAmount)}
                </li>
              ))}
            </ul>
          ) : null}
        </Section>
      ) : null}

      {detail.metadata ? (
        <Section title="Raw metadata" icon={null}>
          <pre className="overflow-x-auto rounded bg-slate-950 p-3 text-[11px] text-slate-400">
            {JSON.stringify(detail.metadata, null, 2)}
          </pre>
        </Section>
      ) : null}
    </div>
  );
}

function MarketplaceTransactionDetail({ detail }: { detail: AdminMarketplaceTransactionDetail }) {
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-4">
        <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-3">
          <p className="text-[11px] uppercase text-slate-500">Status</p>
          <p className="mt-1 text-sm font-semibold text-white">{detail.status}</p>
        </div>
        <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-3">
          <p className="text-[11px] uppercase text-slate-500">Vendor net</p>
          <p className="mt-1 text-lg font-semibold text-emerald-300">{formatZar(detail.amount)}</p>
        </div>
        <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-3">
          <p className="text-[11px] uppercase text-slate-500">Story Time fee</p>
          <p className="mt-1 text-lg font-semibold text-orange-300">{formatZar(detail.feeAmount)}</p>
        </div>
        <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-3">
          <p className="text-[11px] uppercase text-slate-500">Buyer paid</p>
          <p className="mt-1 text-lg font-semibold text-white">{formatZar(detail.totalAmount)}</p>
        </div>
      </div>

      <Section title="Transaction type" icon={<FileText className="h-4 w-4 text-orange-400" />}>
        <dl>
          <DetailRow label="Type" value={detail.typeLabel} />
          <DetailRow label="Reference booking/request" value={detail.referenceId} />
          <DetailRow label="Summary" value={detail.referenceEntity.summary || "—"} />
          {detail.referenceEntity.extra ? (
            <DetailRow
              label="Booking details"
              value={
                <pre className="overflow-x-auto rounded bg-slate-950 p-2 text-[11px] text-slate-400">
                  {JSON.stringify(detail.referenceEntity.extra, null, 2)}
                </pre>
              }
            />
          ) : null}
          <DetailRow label="Fee rate" value={detail.feeRateLabel} />
          <DetailRow label="Created" value={new Date(detail.createdAt).toLocaleString()} />
        </dl>
      </Section>

      <Section title="Parties" icon={<User className="h-4 w-4 text-orange-400" />}>
        <div className="grid gap-3 sm:grid-cols-2">
          <PartyCard title="Buyer (payer)" user={detail.payer} />
          <PartyCard title="Vendor (payee)" user={detail.payee} />
        </div>
      </Section>

      <Section title="Money flow" icon={<ArrowRight className="h-4 w-4 text-orange-400" />}>
        <RevenueRoutingTable category="Marketplace settlement" lines={detail.revenueRouting} />
        <p className="mt-3 text-xs text-slate-500">
          Vendor funds sit in PENDING until the monthly marketplace vendor payout cron releases them to AVAILABLE.
        </p>
      </Section>

      {detail.paymentRecord ? (
        <Section title="Linked PayFast payment record" icon={<Radio className="h-4 w-4 text-orange-400" />}>
          <dl>
            <DetailRow label="Payment record ID" value={detail.paymentRecord.id} />
            <DetailRow label="Purpose" value={detail.paymentRecord.purpose} />
            <DetailRow label="Status" value={detail.paymentRecord.status} />
            <DetailRow label="Amount" value={formatZar(detail.paymentRecord.amount)} />
            <DetailRow label="Provider" value={detail.paymentRecord.provider} />
            <DetailRow
              label="Paid at"
              value={
                detail.paymentRecord.paidAt ? new Date(detail.paymentRecord.paidAt).toLocaleString() : "—"
              }
            />
          </dl>
        </Section>
      ) : null}

      <Section title="Gateway references" icon={<Radio className="h-4 w-4 text-orange-400" />}>
        <dl>
          <DetailRow label="Gateway reference" value={detail.gatewayReference || "—"} />
          <DetailRow label="External payment ID" value={detail.externalPaymentId || "—"} />
        </dl>
      </Section>

      {detail.escrow ? (
        <Section title="Escrow" icon={<Wallet className="h-4 w-4 text-orange-400" />}>
          <dl>
            <DetailRow label="Escrow ID" value={detail.escrow.id} />
            <DetailRow label="Status" value={detail.escrow.status} />
            <DetailRow label="Amount held" value={formatZar(detail.escrow.amount)} />
            <DetailRow label="Release trigger" value={detail.escrow.releaseTrigger || "—"} />
            <DetailRow
              label="Released at"
              value={detail.escrow.releasedAt ? new Date(detail.escrow.releasedAt).toLocaleString() : "—"}
            />
          </dl>
        </Section>
      ) : null}
    </div>
  );
}
