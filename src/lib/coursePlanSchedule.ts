import { parseDateInput } from "@/lib/dates";

export type CoursePlanSubject = "chinese" | "math";

/** JS weekday：0=日 … 6=六。目前班表：數學星期四沒課。 */
const NO_CLASS_WEEKDAYS: Record<CoursePlanSubject, readonly number[]> = {
  chinese: [],
  math: [4],
};

export function subjectHasClassOnDate(
  subject: CoursePlanSubject,
  date: string,
) {
  const weekday = parseDateInput(date).getDay();
  return !NO_CLASS_WEEKDAYS[subject].includes(weekday);
}

export function noClassLockReason(subject: CoursePlanSubject) {
  return subject === "math" ? "本日無數學課" : "本日無國語課";
}
