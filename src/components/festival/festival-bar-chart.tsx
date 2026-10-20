export function FestivalBarChart({
  title,
  bars,
}: {
  title: string;
  bars: { label: string; value: number; color?: string }[];
}) {
  const max = Math.max(1, ...bars.map((b) => b.value));
  return (
    <div className="cinematic-glass rounded-2xl border border-white/8 p-5 shadow-panel">
      <p className="mb-4 text-[11px] font-semibold uppercase tracking-wider text-slate-500">{title}</p>
      <div className="space-y-3">
        {bars.map((b) => (
          <div key={b.label}>
            <div className="mb-1 flex items-center justify-between text-xs">
              <span className="text-slate-400">{b.label}</span>
              <span className="font-medium text-white">{b.value}</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-white/[0.06]">
              <div
                className={`h-full rounded-full transition-all ${b.color ?? "bg-orange-500/80"}`}
                style={{ width: `${Math.round((b.value / max) * 100)}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
