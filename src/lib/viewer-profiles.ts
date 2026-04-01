type ViewerProfileLike = {
  age?: number | null;
  dateOfBirth?: Date | string | null;
};

export function getDateFromBirthParts(year: number, month: number, day: number) {
  return new Date(Date.UTC(year, month - 1, day));
}

export function calculateAgeFromDateOfBirth(dateOfBirth: Date | string, now = new Date()) {
  const birthDate = new Date(dateOfBirth);
  if (Number.isNaN(birthDate.getTime())) return null;

  let age = now.getUTCFullYear() - birthDate.getUTCFullYear();
  const monthDiff = now.getUTCMonth() - birthDate.getUTCMonth();
  const dayDiff = now.getUTCDate() - birthDate.getUTCDate();

  if (monthDiff < 0 || (monthDiff === 0 && dayDiff < 0)) {
    age -= 1;
  }

  return Math.max(0, age);
}

export function getViewerProfileAge(profile?: ViewerProfileLike | null) {
  if (!profile) return null;
  if (profile.dateOfBirth) {
    const derivedAge = calculateAgeFromDateOfBirth(profile.dateOfBirth);
    if (derivedAge != null) return derivedAge;
  }
  if (typeof profile.age === "number") return profile.age;
  return null;
}

export function getBirthDateOptionSets(now = new Date()) {
  const currentYear = now.getUTCFullYear();
  const years = Array.from({ length: 121 }, (_, index) => currentYear - index);
  const months = Array.from({ length: 12 }, (_, index) => ({
    value: index + 1,
    label: new Date(Date.UTC(2000, index, 1)).toLocaleString("en-US", { month: "long", timeZone: "UTC" }),
  }));
  const days = Array.from({ length: 31 }, (_, index) => index + 1);

  return { years, months, days };
}
