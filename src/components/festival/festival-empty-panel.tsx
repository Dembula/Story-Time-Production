import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

export function FestivalEmptyPanel({
  icon: Icon,
  title,
  body,
  actionHref,
  actionLabel,
  children,
}: {
  icon?: LucideIcon;
  title: string;
  body?: string;
  actionHref?: string;
  actionLabel?: string;
  children?: ReactNode;
}) {
  return (
    <div className="cinematic-glass flex flex-col items-center justify-center rounded-2xl border border-white/8 px-6 py-14 text-center shadow-panel">
      {Icon ? (
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-orange-500/20 bg-orange-500/10">
          <Icon className="h-6 w-6 text-orange-300" />
        </div>
      ) : null}
      <h3 className="font-display text-lg font-semibold text-white">{title}</h3>
      {body ? <p className="mt-2 max-w-md text-sm text-slate-400">{body}</p> : null}
      {actionHref && actionLabel ? (
        <Link
          href={actionHref}
          className="mt-5 rounded-lg bg-orange-500/90 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-orange-400"
        >
          {actionLabel}
        </Link>
      ) : null}
      {children}
    </div>
  );
}
