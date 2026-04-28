export type SupportedCountryCode = "ZA" | "US" | "GB" | "NG" | "OTHER";

function normalizeCountry(value?: string): SupportedCountryCode {
  const v = (value ?? "").trim().toUpperCase();
  if (v === "SOUTH AFRICA" || v === "ZA") return "ZA";
  if (v === "UNITED STATES" || v === "USA" || v === "US") return "US";
  if (v === "UNITED KINGDOM" || v === "UK" || v === "GB") return "GB";
  if (v === "NIGERIA" || v === "NG") return "NG";
  return "OTHER";
}

export function validateIdOrPassportByCountry(country?: string, value?: string): string | null {
  const idValue = (value ?? "").trim();
  if (!idValue) return "ID/passport number is required.";

  const code = normalizeCountry(country);
  const rules: Record<SupportedCountryCode, { regex: RegExp; message: string }> = {
    ZA: {
      regex: /^\d{13}$/,
      message: "South African ID must be exactly 13 digits.",
    },
    US: {
      regex: /^[A-Z0-9]{6,12}$/i,
      message: "US passport format should be 6-12 alphanumeric characters.",
    },
    GB: {
      regex: /^[0-9]{9}$/,
      message: "UK passport format should be 9 digits.",
    },
    NG: {
      regex: /^[A-Z][0-9]{8}$/i,
      message: "Nigerian passport format should be one letter followed by 8 digits.",
    },
    OTHER: {
      regex: /^[A-Z0-9\-]{5,20}$/i,
      message: "ID/passport should be 5-20 alphanumeric characters.",
    },
  };

  const rule = rules[code];
  return rule.regex.test(idValue) ? null : rule.message;
}
