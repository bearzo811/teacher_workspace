export type Term = { id: string; name: string; start_date: string; end_date: string; active: boolean };
export type DayOverride = { day: string; is_school_day: boolean; note: string };
const dayMs = 86_400_000;
export function validDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value + "T00:00:00Z"))
    && new Date(value + "T00:00:00Z").toISOString().slice(0, 10) === value;
}
export function validRange(start: string, end: string) {
  return validDate(start) && validDate(end) && start <= end && Date.parse(end) - Date.parse(start) <= 366 * dayMs;
}
export function schoolDay(day: string, term: Term, overrides: readonly DayOverride[]) {
  if (!validDate(day) || day < term.start_date || day > term.end_date) return false;
  const custom = overrides.find(item => item.day === day);
  if (custom) return custom.is_school_day;
  const weekday = new Date(day + "T00:00:00Z").getUTCDay();
  return weekday !== 0 && weekday !== 6;
}
// Week one includes the actual start date; later weeks begin on Monday.
export function termWeek(day: string, term: Term): number | null {
  if (!validDate(day) || day < term.start_date || day > term.end_date) return null;
  const start = new Date(term.start_date + "T00:00:00Z");
  const mondayOffset = (start.getUTCDay() + 6) % 7;
  return Math.floor((Date.parse(day) - start.getTime() + mondayOffset * dayMs) / (7 * dayMs)) + 1;
}
export function nextSchoolDay(day: string, term: Term, overrides: readonly DayOverride[]): string | null {
  if (!validDate(day) || !validRange(term.start_date, term.end_date)) return null;
  let time = Math.max(Date.parse(day) + dayMs, Date.parse(term.start_date));
  for (; time <= Date.parse(term.end_date); time += dayMs) {
    const next = new Date(time).toISOString().slice(0, 10);
    if (schoolDay(next, term, overrides)) return next;
  }
  return null;
}
export function taipeiToday() {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Taipei", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts();
  return ["year", "month", "day"].map(type => parts.find(part => part.type === type)!.value).join("-");
}
