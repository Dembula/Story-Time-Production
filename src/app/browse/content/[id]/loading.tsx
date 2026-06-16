/** Inline placeholder — avoids a full-viewport flash over browse chrome. */
export default function ContentDetailLoading() {
  return (
    <div className="animate-pulse" aria-hidden>
      <div className="min-h-[68vh] bg-gradient-to-b from-slate-900/90 via-slate-950/70 to-background" />
      <div className="mx-auto max-w-4xl space-y-4 px-4 py-8">
        <div className="h-8 w-2/3 rounded-lg bg-white/5" />
        <div className="h-4 w-full rounded bg-white/5" />
        <div className="h-4 w-5/6 rounded bg-white/5" />
      </div>
    </div>
  );
}
