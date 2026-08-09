export const TAIPEI_TIME_ZONE = "Asia/Taipei";

export type GamificationProgress = {
  level: number;
  totalXp: number;
  currentLevelXp: number;
  nextLevelXp: number;
  progressPercent: number;
};

export function gamificationProgress(
  xpTotal: number,
  levelBaseXp = 100,
): GamificationProgress {
  const totalXp = Math.max(0, Math.trunc(xpTotal));
  const base = Math.max(1, Math.trunc(levelBaseXp));
  let level = 1;
  let remaining = totalXp;
  while (remaining >= base * level) {
    remaining -= base * level;
    level += 1;
  }
  const nextLevelXp = base * level;
  return {
    level,
    totalXp,
    currentLevelXp: remaining,
    nextLevelXp,
    progressPercent: Math.round((remaining / nextLevelXp) * 100),
  };
}

export function displayCoins(coinNet: number) {
  return Math.max(0, Math.trunc(coinNet));
}

export function taipeiDateString(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TAIPEI_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const value = Object.fromEntries(
    parts.map((part) => [part.type, part.value]),
  );
  return `${value.year}-${value.month}-${value.day}`;
}

export function addCalendarDays(dateString: string, days: number) {
  const [year, month, day] = dateString.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + days));
  return [
    date.getUTCFullYear(),
    String(date.getUTCMonth() + 1).padStart(2, "0"),
    String(date.getUTCDate()).padStart(2, "0"),
  ].join("-");
}

/** 台北當地日期已超過截止日，代表截止日 23:59:59 已過。 */
export function isPastLocalDeadline(deadlineDate: string, now = new Date()) {
  return taipeiDateString(now) > deadlineDate;
}

export function isCompletedOnTime(completedAt: Date, deadlineDate: string) {
  return taipeiDateString(completedAt) <= deadlineDate;
}

export function effectKey(...parts: Array<string | number>) {
  return parts.map(String).join(":");
}
