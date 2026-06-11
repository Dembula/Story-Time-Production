/** Time-of-day greeting for MODOC (client + server safe). */

export function getTimeOfDayGreeting(date = new Date()): string {
  const hour = date.getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  if (hour < 21) return "Good evening";
  return "Good night";
}

export function getFirstName(displayName: string | null | undefined): string {
  if (!displayName?.trim()) return "there";
  const first = displayName.trim().split(/\s+/)[0];
  return first || "there";
}

export function buildModocGreeting(
  displayName: string | null | undefined,
  date = new Date(),
): string {
  return `${getTimeOfDayGreeting(date)}, ${getFirstName(displayName)}`;
}

export function isSameCalendarDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}
