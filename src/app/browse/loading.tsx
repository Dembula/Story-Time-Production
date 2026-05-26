import { Skeleton } from "@/components/ui/skeleton";

export default function BrowseLoading() {
  return (
    <div className="mx-auto max-w-7xl px-4 pb-16 pt-4 md:px-8">
      <Skeleton className="mb-8 h-[50vh] min-h-[320px] w-full rounded-2xl bg-white/[0.06]" />
      <Skeleton className="mb-6 h-12 max-w-xl rounded-2xl bg-white/[0.06]" />
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="mb-12">
          <Skeleton className="mb-4 h-7 w-40 bg-white/[0.06]" />
          <div className="flex gap-4 overflow-hidden">
            {Array.from({ length: 6 }).map((_, j) => (
              <Skeleton key={j} className="h-72 w-52 shrink-0 rounded-2xl bg-white/[0.06]" />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
