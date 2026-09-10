"use client";

export type DemographicSlice = {
  label: string;
  viewers: number;
  pct: number;
};

const PIE_COLORS = [
  "#f97316",
  "#22d3ee",
  "#a78bfa",
  "#34d399",
  "#f472b6",
  "#fbbf24",
  "#60a5fa",
  "#94a3b8",
];

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function describeArc(cx: number, cy: number, r: number, startAngle: number, endAngle: number) {
  const start = polarToCartesian(cx, cy, r, endAngle);
  const end = polarToCartesian(cx, cy, r, startAngle);
  const largeArc = endAngle - startAngle > 180 ? 1 : 0;
  return `M ${cx} ${cy} L ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 0 ${end.x} ${end.y} Z`;
}

export function AudiencePieChart({
  rows,
  title,
  emptyMessage = "Not enough demographic data in this window yet.",
}: {
  rows: DemographicSlice[];
  title?: string;
  emptyMessage?: string;
}) {
  const active = rows.filter((r) => r.label !== "Unknown" && r.viewers > 0);
  const totalKnown = active.reduce((sum, r) => sum + r.viewers, 0);
  const unknown = rows.find((r) => r.label === "Unknown" && r.viewers > 0);

  if (totalKnown === 0) {
    return (
      <div className="rounded-xl border border-white/8 bg-slate-950/30 p-4">
        {title ? <p className="mb-2 text-sm font-medium text-white">{title}</p> : null}
        <p className="text-sm text-slate-500">{emptyMessage}</p>
      </div>
    );
  }

  const size = 160;
  const cx = size / 2;
  const cy = size / 2;
  const r = 68;
  let angle = 0;
  const slices = active.map((row, i) => {
    const sweep = (row.viewers / totalKnown) * 360;
    const start = angle;
    const end = angle + Math.max(sweep, 0.4);
    angle = end;
    return {
      ...row,
      path: describeArc(cx, cy, r, start, end),
      color: PIE_COLORS[i % PIE_COLORS.length]!,
    };
  });

  return (
    <div className="rounded-xl border border-white/8 bg-slate-950/30 p-4 space-y-4">
      {title ? <p className="text-sm font-medium text-white">{title}</p> : null}
      <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start sm:gap-5">
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="shrink-0" aria-hidden>
          {slices.length === 1 ? (
            <circle cx={cx} cy={cy} r={r} fill={slices[0]!.color} />
          ) : (
            slices.map((slice) => (
              <path key={slice.label} d={slice.path} fill={slice.color} opacity={0.92} />
            ))
          )}
          <circle cx={cx} cy={cy} r={34} fill="#020617" />
          <text
            x={cx}
            y={cy - 2}
            textAnchor="middle"
            className="fill-slate-200"
            style={{ fontSize: 14, fontWeight: 600 }}
          >
            {totalKnown}
          </text>
          <text
            x={cx}
            y={cy + 14}
            textAnchor="middle"
            className="fill-slate-500"
            style={{ fontSize: 9 }}
          >
            viewers
          </text>
        </svg>
        <ul className="w-full min-w-0 space-y-2">
          {slices.map((slice) => {
            const knownPct = totalKnown > 0 ? Math.round((slice.viewers / totalKnown) * 1000) / 10 : 0;
            return (
              <li key={slice.label} className="flex items-center gap-2 text-[12px]">
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: slice.color }}
                  aria-hidden
                />
                <span className="min-w-0 flex-1 truncate text-slate-300">{slice.label}</span>
                <span className="shrink-0 tabular-nums text-slate-400">
                  {slice.viewers} · {knownPct}%
                </span>
              </li>
            );
          })}
        </ul>
      </div>
      {unknown ? (
        <p className="text-[11px] text-slate-500">
          {unknown.viewers} viewer{unknown.viewers === 1 ? "" : "s"} without this demographic set
        </p>
      ) : null}
    </div>
  );
}
