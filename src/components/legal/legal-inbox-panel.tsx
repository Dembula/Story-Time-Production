"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { FileText, Inbox } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

type InboxItem = {
  id: string;
  projectId: string;
  projectTitle: string;
  title: string;
  status: string;
  statusLabel: string;
  senderName: string | null;
  requiredAction: string | null;
  signatureDeadline: string | null;
  updatedAt: string;
};

type LegalInboxPanelProps = {
  /** When set, contract links open inside the project Legal & Contracts workspace. */
  projectId?: string;
  contractsBasePath?: string;
};

export function LegalInboxPanel({ projectId, contractsBasePath }: LegalInboxPanelProps) {
  const { data, isLoading } = useQuery({
    queryKey: ["legal-inbox"],
    queryFn: () => fetch("/api/creator/legal/inbox").then((r) => r.json()),
  });

  const waiting = (data?.buckets?.waitingForYou ?? []) as InboxItem[];
  const pending = (data?.buckets?.pending ?? []) as InboxItem[];
  const completed = (data?.buckets?.completed ?? []) as InboxItem[];

  function contractHref(item: InboxItem): string {
    if (contractsBasePath) {
      return `${contractsBasePath}?tab=inbox&contractId=${encodeURIComponent(item.id)}`;
    }
    if (projectId) {
      return `/creator/projects/${projectId}/pre-production/legal-contracts?tab=inbox&contractId=${encodeURIComponent(item.id)}`;
    }
    return `/creator/projects/${item.projectId}/pre-production/legal-contracts?tab=inbox&contractId=${encodeURIComponent(item.id)}`;
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-white flex items-center gap-2">
          <Inbox className="h-4 w-4 text-orange-400" />
          Contract inbox
        </h3>
        <p className="mt-1 text-xs text-slate-400">
          Agreements sent to you for review and signature across your projects.
        </p>
      </div>

      {isLoading ? (
        <Skeleton className="h-32 bg-slate-800/60" />
      ) : (
        <>
          <InboxSection title="Waiting for you" items={waiting} empty="No contracts need your signature." highlight contractHref={contractHref} />
          <InboxSection title="In progress" items={pending} empty="No contracts awaiting counter-signature." contractHref={contractHref} />
          <InboxSection title="Completed" items={completed.slice(0, 20)} empty="No executed contracts yet." contractHref={contractHref} />
        </>
      )}
    </div>
  );
}

function InboxSection({
  title,
  items,
  empty,
  highlight,
  contractHref,
}: {
  title: string;
  items: InboxItem[];
  empty: string;
  highlight?: boolean;
  contractHref: (item: InboxItem) => string;
}) {
  return (
    <section className="rounded-xl border border-slate-800 bg-slate-900/50 p-3 space-y-2">
      <h4 className="text-xs font-medium text-white">{title}</h4>
      {items.length === 0 ? (
        <p className="text-[11px] text-slate-500">{empty}</p>
      ) : (
        <ul className="space-y-2">
          {items.map((c) => (
            <li key={c.id}>
              <Link
                href={contractHref(c)}
                className={`flex flex-col gap-1 rounded-lg border px-3 py-2.5 text-sm transition hover:border-orange-500/40 ${
                  highlight ? "border-orange-500/25 bg-orange-500/5" : "border-slate-800 bg-slate-900/70"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="font-medium text-white flex items-center gap-2 text-xs">
                    <FileText className="h-3.5 w-3.5 text-slate-500 shrink-0" />
                    {c.title}
                  </span>
                  <span className="text-[10px] rounded-full border border-slate-600 px-2 py-0.5 text-slate-300">
                    {c.statusLabel}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 pl-5">
                  {c.projectTitle}
                  {c.senderName ? ` · From ${c.senderName}` : ""}
                </p>
                {c.requiredAction && (
                  <p className="text-[11px] text-orange-200/90 pl-5">{c.requiredAction}</p>
                )}
                {c.signatureDeadline && (
                  <p className="text-[10px] text-slate-500 pl-5">
                    Sign by {new Date(c.signatureDeadline).toLocaleDateString()}
                  </p>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
