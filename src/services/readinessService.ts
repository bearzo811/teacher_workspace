import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { homeworkBooks, students } from "@/db/schema";
import { getClassSettings } from "@/services/classSettingsService";
import { getDisplayData } from "@/services/displayService";
import { getDutyDay } from "@/services/dutyService";
import { getActiveTerm } from "@/services/termService";

export type ReadinessStatus = "pass" | "warning" | "fail";
export type ReadinessCheck = {
  id: string;
  title: string;
  detail: string;
  status: ReadinessStatus;
};

export type SemesterReadinessView = {
  generatedAt: string;
  checks: ReadinessCheck[];
  smokeChecks: ReadinessCheck[];
};

/** 開學前的安全只讀檢查；不建立或變動任何正式資料。 */
export async function getSemesterReadiness(): Promise<SemesterReadinessView> {
  const [settings, term, roster, books] = await Promise.all([
    getClassSettings(),
    getActiveTerm(),
    db.select({ id: students.id, seatNumber: students.seatNumber }).from(students).where(eq(students.isActive, true)).orderBy(asc(students.seatNumber)),
    db.select({ id: homeworkBooks.id }).from(homeworkBooks).where(eq(homeworkBooks.isActive, true)),
  ]);
  const displayResult = await Promise.allSettled([getDisplayData()]);
  const display = displayResult[0].status === "fulfilled" ? displayResult[0].value : null;
  const duty = term ? await getDutyDay(term.startsOn) : null;
  const uniqueSeats = new Set(roster.map((student) => student.seatNumber)).size === roster.length;

  const checks: ReadinessCheck[] = [
    term
      ? { id: "term", title: "啟用學期", detail: `${term.schoolYear} 學年度 ${term.name}：${term.startsOn} ～ ${term.endsOn}`, status: "pass" }
      : { id: "term", title: "啟用學期", detail: "尚未建立或啟用學期。", status: "fail" },
    roster.length > 0
      ? { id: "roster", title: "在籍學生", detail: `目前 ${roster.length} 位學生。`, status: roster.length === 9 ? "pass" : "warning" }
      : { id: "roster", title: "在籍學生", detail: "沒有在籍學生。", status: "fail" },
    uniqueSeats
      ? { id: "seats", title: "座號", detail: "在籍學生座號沒有重複。", status: "pass" }
      : { id: "seats", title: "座號", detail: "發現重複座號，請先修正名冊。", status: "fail" },
    books.length > 0
      ? { id: "books", title: "作業簿本", detail: `已啟用 ${books.length} 本簿本。`, status: "pass" }
      : { id: "books", title: "作業簿本", detail: "尚未建立可用簿本。", status: "warning" },
    duty && !duty.isHoliday && duty.slots.filter((slot) => slot.studentId).length === 9
      ? { id: "duty", title: "值日與午餐工作", detail: "學期第一個上課日已能產生 9 個工作。", status: "pass" }
      : { id: "duty", title: "值日與午餐工作", detail: "無法在學期第一個日期產生完整值日；請檢查學期與名冊。", status: "warning" },
    settings.displayFontSize >= 12 && settings.displayFontSize <= 32
      ? { id: "display-font", title: "大屏字級", detail: `目前基準字級 ${settings.displayFontSize}px。`, status: "pass" }
      : { id: "display-font", title: "大屏字級", detail: "字級不在 12～32px 範圍。", status: "warning" },
  ];

  const smokeChecks: ReadinessCheck[] = [
    display
      ? { id: "display-payload", title: "大屏資料載入", detail: `已成功組裝大屏資料：${display.students.length} 位學生。`, status: "pass" }
      : { id: "display-payload", title: "大屏資料載入", detail: "大屏資料讀取失敗，請查看部署與資料庫。", status: "fail" },
    display && display.personal.length === roster.length
      ? { id: "display-roster", title: "大屏名冊同步", detail: "大屏與後台在籍學生數一致。", status: "pass" }
      : { id: "display-roster", title: "大屏名冊同步", detail: "大屏名冊與後台不一致。", status: "fail" },
    display && display.dutyToday.slots.length === 9
      ? { id: "display-duty", title: "大屏值日資料", detail: "大屏取得 9 個值日／午餐工作欄位。", status: "pass" }
      : { id: "display-duty", title: "大屏值日資料", detail: "大屏值日資料不完整。", status: "warning" },
    { id: "manual-touch", title: "觸控操作確認", detail: "請在白板實測：午餐任務、作業回報、商店購買各一次；此項不自動改正式學生資料。", status: "warning" },
  ];

  return { generatedAt: new Date().toISOString(), checks, smokeChecks };
}
