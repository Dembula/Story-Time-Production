"use client";

import Image from "next/image";
import {
  FPB_DISTRIBUTOR_LICENSE,
  FPB_LOGO_PATH,
  formatAdvisoryShort,
  formatPlaybackAgeLabel,
} from "@/lib/fpb-compliance";

type PlaybackComplianceBadgeProps = {
  ageRating?: string | null;
  minAge?: number;
  advisory?: Record<string, unknown> | null;
  /** `playback` = compact overlay beside controls; `footer` = landing footer block with licence */
  variant?: "playback" | "footer";
  className?: string;
};

/** Age rating + FPB distributor badge (Apple TV–style compliance strip). */
export function PlaybackComplianceBadge({
  ageRating,
  minAge = 0,
  advisory,
  variant = "playback",
  className = "",
}: PlaybackComplianceBadgeProps) {
  const ageLabel = formatPlaybackAgeLabel(ageRating, minAge);
  const advisoryCodes = formatAdvisoryShort(advisory);

  if (variant === "footer") {
    return (
      <div className={`flex flex-col items-center text-center ${className}`}>
        <Image
          src={FPB_LOGO_PATH}
          alt="Film and Publication Board"
          width={52}
          height={52}
          className="h-[52px] w-auto object-contain"
        />
        <p className="mt-1.5 text-[10px] font-medium tracking-wide text-slate-500">
          {FPB_DISTRIBUTOR_LICENSE}
        </p>
      </div>
    );
  }

  return (
    <div
      className={`pointer-events-none flex items-center gap-2 ${className}`}
      aria-label={`Age rating ${ageLabel}. FPB licensed distributor ${FPB_DISTRIBUTOR_LICENSE}.`}
    >
      <div className="flex items-center gap-1.5 rounded-md border border-white/25 bg-black/65 px-2 py-1 backdrop-blur-md">
        <span className="text-[11px] font-bold tracking-wide text-white">{ageLabel}</span>
        {advisoryCodes && (
          <span className="border-l border-white/20 pl-1.5 text-[10px] font-semibold text-white/75">
            {advisoryCodes}
          </span>
        )}
      </div>
      <Image
        src={FPB_LOGO_PATH}
        alt="FPB"
        width={28}
        height={28}
        className="h-7 w-auto shrink-0 object-contain drop-shadow-sm"
      />
    </div>
  );
}
