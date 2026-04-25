/**
 * Parse common screenplay slugline fragments for INT/EXT and time-of-day.
 * Heading examples: INT. KITCHEN - DAY | EXT. HIGHWAY - NIGHT | INT./EXT. CABIN - DAWN
 */
export function parseSluglineMeta(heading: string | null | undefined): {
  intExt: string | null;
  timeOfDay: string | null;
} {
  if (!heading?.trim()) {
    return { intExt: null, timeOfDay: null };
  }
  const h = heading.trim().toUpperCase();

  let intExt: string | null = null;
  if (/^INT\.\/EXT\.|^I\/E\b|^INT\/EXT/i.test(heading.trim())) {
    intExt = "INT_EXT";
  } else if (/^INT\./i.test(heading.trim())) {
    intExt = "INT";
  } else if (/^EXT\./i.test(heading.trim())) {
    intExt = "EXT";
  }

  let timeOfDay: string | null = null;
  const timePatterns: Array<{ re: RegExp; label: string }> = [
    { re: /\b-\s*CONTINUOUS\b/i, label: "CONTINUOUS" },
    { re: /\b-\s*LATER\b/i, label: "LATER" },
    { re: /\b-\s*SAME\b/i, label: "SAME" },
    { re: /\b-\s*DAWN\b/i, label: "DAWN" },
    { re: /\b-\s*DUSK\b/i, label: "DUSK" },
    { re: /\b-\s*SUNSET\b/i, label: "DUSK" },
    { re: /\b-\s*SUNRISE\b/i, label: "DAWN" },
    { re: /\b-\s*DAY\b/i, label: "DAY" },
    { re: /\b-\s*NIGHT\b/i, label: "NIGHT" },
    { re: /\b-\s*MORNING\b/i, label: "DAY" },
    { re: /\b-\s*EVENING\b/i, label: "NIGHT" },
    { re: /\b-\s*AFTERNOON\b/i, label: "DAY" },
    { re: /\bDAY\b/, label: "DAY" },
    { re: /\bNIGHT\b/, label: "NIGHT" },
  ];
  for (const { re, label } of timePatterns) {
    if (re.test(heading)) {
      timeOfDay = label;
      break;
    }
  }

  if (h.includes("DAY") && !timeOfDay) timeOfDay = "DAY";
  if (h.includes("NIGHT") && !timeOfDay) timeOfDay = "NIGHT";

  return { intExt, timeOfDay };
}
