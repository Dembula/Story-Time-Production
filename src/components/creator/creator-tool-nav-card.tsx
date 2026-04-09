import Link from "next/link";
import { CheckCircle, Circle, Loader2, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

export type CreatorToolNavStatus = "done" | "in_progress" | "not_started" | "linked";

export function CreatorToolNavCard({
  href,
  label,
  description,
  status,
  hub = false,
}: {
  href: string;
  label: string;
  description: string;
  status?: CreatorToolNavStatus;
  /** Phase hub: neutral card without pipeline progress. */
  hub?: boolean;
}) {
  if (hub) {
    return (
      <Link
        href={href}
        className={cn(
          "storytime-plan-card group flex h-full min-h-[7.5rem] flex-col p-4 text-left transition duration-200",
          "hover:-translate-y-1 hover:scale-[1.01] hover:border-white/14"
        )}
      >
        <div className="min-w-0 flex-1">
          <div className="mb-2 inline-flex items-center gap-1.5 rounded-full border border-orange-400/20 bg-orange-500/10 px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-orange-200/90">
            <Sparkles className="h-3 w-3 shrink-0" />
            Tool
          </div>
          <h3 className="text-[15px] font-semibold leading-snug text-white">{label}</h3>
          <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-slate-400">{description}</p>
        </div>
      </Link>
    );
  }

  const s = status ?? "not_started";
  const done = s === "done" || s === "linked";
  const inProgress = s === "in_progress";
  const statusLabel =
    s === "done"
      ? "Done"
      : s === "linked"
        ? "Linked"
        : inProgress
          ? "In progress"
          : "Not started";


  return (
    <Link
      href={href}
      data-selected={done ? "true" : undefined}
      className={cn(
        "storytime-plan-card group flex h-full min-h-[7.5rem] flex-col p-4 text-left transition duration-200",
        "hover:-translate-y-1 hover:scale-[1.01]",
        done
          ? "border-orange-400/40 bg-orange-500/[0.08] shadow-glow"
          : inProgress
            ? "border-amber-400/25 hover:border-amber-400/35"
            : "hover:border-white/14"
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="mb-2 inline-flex items-center gap-1.5 rounded-full border border-white/[0.08] bg-white/[0.04] px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-400">
            {done ? (
              <CheckCircle className="h-3 w-3 shrink-0 text-emerald-400" />
            ) : inProgress ? (
              <Loader2 className="h-3 w-3 shrink-0 animate-spin text-amber-400" />
            ) : (
              <Circle className="h-3 w-3 shrink-0 text-slate-600" />
            )}
            {statusLabel}
          </div>
          <h3 className="text-[15px] font-semibold leading-snug text-white">{label}</h3>
          <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-slate-400">{description}</p>
        </div>
      </div>
    </Link>
  );
}
