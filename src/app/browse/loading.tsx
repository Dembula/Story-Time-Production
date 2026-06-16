/** Inline browse skeleton — keeps navbar visible while catalogue loads. */
export default function BrowseLoading() {
  return (
    <div className="animate-pulse px-4 pt-2" aria-hidden>
      <div className="mb-8 min-h-[42vh] rounded-2xl bg-white/[0.04]" />
      <div className="mb-6 h-5 w-40 rounded bg-white/5" />
      <div className="flex gap-3 overflow-hidden">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-36 w-28 shrink-0 rounded-lg bg-white/5 sm:h-44 sm:w-32" />
        ))}
      </div>
    </div>
  );
}
