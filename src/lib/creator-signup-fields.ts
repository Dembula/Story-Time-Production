export const STUDIO_CREATOR_TYPES = new Set(["content", "music"]);
export const MARKETPLACE_CREATOR_TYPES = new Set([
  "equipment",
  "location",
  "crew",
  "casting",
  "catering",
  "funder",
]);

export function isStudioCreatorSignupType(type: string): boolean {
  return STUDIO_CREATOR_TYPES.has(type);
}

export const SIGNUP_BIO_PLACEHOLDERS: Record<string, string> = {
  content: "Tell viewers about your films, style, and the stories you want to tell…",
  music: "Tell listeners about your sound, influences, and what you create…",
  equipment: "Describe your kit, services, and what productions you support…",
  location: "Describe your locations, facilities, and booking experience…",
  crew: "Introduce your crew team, specialties, and typical productions…",
  casting: "Introduce your agency, talent focus, and casting experience…",
  catering: "Describe your menu style, event types, and on-set experience…",
  funder: "Share your investment focus, thesis, and what kinds of projects you back…",
};

export function signupBioPlaceholder(type: string): string {
  return SIGNUP_BIO_PLACEHOLDERS[type] ?? "Tell collaborators what you do and who you work with…";
}
