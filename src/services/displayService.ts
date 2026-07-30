import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { students } from "@/db/schema";
import { todayDateString } from "@/lib/dates";
import { getClassSettings } from "@/services/classSettingsService";
import { getContactBook } from "@/services/contactBookService";
import { getHomeworkDayView } from "@/services/homeworkService";
import { getPassportWeekView } from "@/services/passportService";
import type { DisplayData } from "@/types/display";

export type { DisplayData };

/**
 * Classroom display aggregation — Single Source of Truth for /display.
 */
export async function getDisplayData(): Promise<DisplayData> {
  const settings = await getClassSettings();
  const today = todayDateString();

  const [contactBook, homework, chinese, english, activeStudents] =
    await Promise.all([
      getContactBook(today),
      getHomeworkDayView(today),
      getPassportWeekView("Chinese", settings.currentWeek),
      getPassportWeekView("English", settings.currentWeek),
      db
        .select({
          studentId: students.id,
          name: students.name,
          seatNumber: students.seatNumber,
        })
        .from(students)
        .where(eq(students.isActive, true))
        .orderBy(asc(students.seatNumber)),
    ]);

  return {
    className: settings.className,
    schoolYear: settings.schoolYear,
    today,
    contactBook: {
      date: contactBook.date,
      dueDate: contactBook.dueDate,
      note: contactBook.note,
      titles: contactBook.titles,
    },
    homework,
    passport: {
      chinese,
      english,
    },
    displaySettings: {
      allowStudentHomeworkToggle: settings.allowDisplayHomeworkToggle,
      allowStudentPassportToggle: settings.allowDisplayPassportToggle,
      carouselEnabled: settings.displayCarouselEnabled,
      refreshSeconds: Math.max(5, settings.displayRefreshSeconds || 20),
      hasToken: Boolean(settings.displayToken.trim()),
    },
    students: activeStudents,
  };
}

export async function assertDisplayToken(token: string | null | undefined) {
  const settings = await getClassSettings();
  const expected = settings.displayToken.trim();
  if (!expected) return;
  if ((token ?? "").trim() !== expected) {
    throw new Error("大屏存取碼錯誤");
  }
}

export async function assertDisplayHomeworkToggleEnabled() {
  const settings = await getClassSettings();
  if (!settings.allowDisplayHomeworkToggle) {
    throw new Error("老師尚未開放大屏作業打勾");
  }
}

export async function assertDisplayPassportToggleEnabled(week: number) {
  const settings = await getClassSettings();
  if (!settings.allowDisplayPassportToggle) {
    throw new Error("老師尚未開放大屏護照點選");
  }
  if (week !== settings.currentWeek) {
    throw new Error("大屏只能修改目前週護照");
  }
}
