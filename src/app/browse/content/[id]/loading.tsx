import { Skeleton } from "@/components/ui/skeleton";

export default function ContentDetailLoading() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-8 md:px-8">
      <Skeleton className="mb-8 aspect-video w-full rounded-2xl bg-white/[0.06]" />
      <Skeleton className="mb-4 h-10 w-2/3 max-w-lg bg-white/[0.06]" />
      <Skeleton className="mb-2 h-4 w-full max-w-2xl bg-white/[0.06]" />
      <Skeleton className="h-4 w-4/5 max-w-xl bg-white/[0.06]" />
    </div>
  );
}
