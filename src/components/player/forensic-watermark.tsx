"use client";

type ForensicWatermarkProps = {
  label: string;
  visible?: boolean;
};

export function ForensicWatermark({ label, visible = true }: ForensicWatermarkProps) {
  if (!visible || !label) return null;

  return (
    <div
      className="pointer-events-none absolute inset-0 z-[15] overflow-hidden"
      aria-hidden
    >
      <div className="absolute inset-0 opacity-[0.14]">
        {Array.from({ length: 6 }).map((_, row) =>
          Array.from({ length: 4 }).map((__, col) => (
            <span
              key={`${row}-${col}`}
              className="absolute select-none whitespace-nowrap text-[10px] font-medium uppercase tracking-[0.2em] text-white/80"
              style={{
                top: `${12 + row * 16}%`,
                left: `${8 + col * 24}%`,
                transform: `rotate(-18deg)`,
              }}
            >
              {label}
            </span>
          )),
        )}
      </div>
    </div>
  );
}
