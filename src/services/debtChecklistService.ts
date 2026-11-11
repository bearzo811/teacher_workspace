import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { students, studentDebtOrders } from "@/db/schema";
import { todayDateString } from "@/lib/dates";
import { prepareDebtChecklist, type DebtChecklistItem } from "@/lib/debtChecklist";
import { getClassSettings } from "@/services/classSettingsService";
import { passportDebts, readingDebts } from "@/services/displayService";
import { listStudentHomeworkDebts } from "@/services/homeworkService";
import { getPassportMatrix } from "@/services/passportService";
import { getReadingMatrix } from "@/services/readingService";

export async function getStudentDebtChecklist(studentId: string) {
  const [student] = await db.select({ name: students.name, seatNumber: students.seatNumber })
    .from(students).where(and(eq(students.id, studentId), eq(students.isActive, true)));
  if (!student) return null;

  const today = todayDateString();
  const [settings, homework, chinese, english, newspaper, reflection, preferences] = await Promise.all([
    getClassSettings(), listStudentHomeworkDebts(today),
    getPassportMatrix("Chinese"), getPassportMatrix("English"),
    getReadingMatrix("newspaper"), getReadingMatrix("reflection"),
    db.select().from(studentDebtOrders).where(eq(studentDebtOrders.studentId, studentId)),
  ]);
  const termKey = `${settings.schoolYear}:${settings.weekOneStartDate}`;
  const passports = [
    ...passportDebts(chinese, studentId).map((item) => ({ ...item, key: `chinese:${termKey}:${item.label}`, label: `國語護照 第 ${item.label.slice(1)} 週`, week: Number(item.label.slice(1)) })),
    ...passportDebts(english, studentId).map((item) => ({ ...item, key: `english:${termKey}:${item.label}`, label: `英語護照 第 ${item.label.slice(1)} 週`, week: Number(item.label.slice(1)) })),
  ].sort((a, b) => a.week - b.week);
  const month = Number(today.slice(5, 7));
  const reading = [
    ...readingDebts(newspaper, studentId, month).map((item) => ({ ...item, key: `newspaper:${termKey}:${item.label}`, label: `讀報 ${item.label}`, month: Number(item.label.replace("月", "")) })),
    ...readingDebts(reflection, studentId, month).map((item) => ({ ...item, key: `reflection:${termKey}:${item.label}`, label: `閱讀心得 ${item.label}`, month: Number(item.label.replace("月", "")) })),
  ].sort((a, b) => ((a.month + 3) % 12) - ((b.month + 3) % 12));
  const items: DebtChecklistItem[] = [
    ...(homework.get(studentId) ?? []).map((item) => ({ ...item, key: `homework:${item.id}`, category: "作業" as const })),
    ...passports.map((item) => ({ ...item, category: "護照" as const })),
    ...reading.map((item) => ({ ...item, category: "閱讀／讀報" as const })),
  ];
  return {
    ...student, className: settings.className, asOfDate: today,
    items: prepareDebtChecklist(items, preferences[0] ? JSON.parse(preferences[0].itemKeys) as string[] : []),
  };
}
