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

export default function LegalInboxPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["legal-inbox"],
    queryFn: () => fetch("/api/creator/legal/inbox").then((r) => r.json()),
  });

  const waiting = (data?.buckets?.waitingForYou ?? []) as InboxItem[];
  const pending = (data?.buckets?.pending ?? []) as InboxItem[];
  const completed = (data?.buckets?.completed ?? []) as InboxItem[];

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-4 md:p-8">
      <header className="space-y-2">
        <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-orange-300/80">Legal</p>
        <h1 className="font-display text-2xl font-semibold text-white flex items-center gap-2">
          <Inbox className="h-6 w-6 text-orange-400" />
          Contract inbox
        </h1>
        <p className="text-sm text-slate-400">
          Contracts sent to you for review and signature across all Story Time projects.
        </p>
      </header>

      {isLoading ? (
        <Skeleton className="h-48 bg-slate-800/60" />
      ) : (
        <>
          <InboxSection title="Waiting for you" items={waiting} empty="No contracts need your signature." highlight />
          <InboxSection title="In progress" items={pending} empty="No contracts awaiting counter-signature." />
          <InboxSection title="Completed" items={completed.slice(0, 20)} empty="No executed contracts yet." />
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
}: {
  title: string;
  items: InboxItem[];
  empty: string;
  highlight?: boolean;
}) {
  return (
    <section className="creator-glass-panel p-4 space-y-3">
      <h2 className="text-sm font-medium text-white">{title}</h2>
      {items.length === 0 ? (
        <p className="text-xs text-slate-500">{empty}</p>
      ) : (
        <ul className="space-y-2">
          {items.map((c) => (
            <li key={c.id}>
              <Link
                href={`/creator/legal/inbox/${c.id}?projectId=${encodeURIComponent(c.projectId)}`}
                className={`flex flex-col gap-1 rounded-xl border px-3 py-3 text-sm transition hover:border-orange-500/40 ${
                  highlight ? "border-orange-500/25 bg-orange-500/5" : "border-slate-800 bg-slate-900/70"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="font-medium text-white flex items-center gap-2">
                    <FileText className="h-4 w-4 text-slate-500 shrink-0" />
                    {c.title}
                  </span>
                  <span className="text-[10px] rounded-full border border-slate-600 px-2 py-0.5 text-slate-300">
                    {c.statusLabel}
                  </span>
                </div>
                <p className="text-xs text-slate-400 pl-6">
                  {c.projectTitle}
                  {c.senderName ? ` · From ${c.senderName}` : ""}
                </p>
                {c.requiredAction && (
                  <p className="text-xs text-orange-200/90 pl-6">{c.requiredAction}</p>
                )}
                {c.signatureDeadline && (
                  <p className="text-[10px] text-slate-500 pl-6">
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
