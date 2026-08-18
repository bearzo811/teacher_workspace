import { and, asc, eq, gte, lte } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { dailyStudentTasks, gamificationLedger, homework, homeworkBooks, homeworkRecords, passportRecords, readingRecords, shopItems, shopOrders, students } from "@/db/schema";
import { getActiveTerm } from "@/services/termService";

export const dynamic = "force-dynamic";

function csv(rows: Array<Record<string, unknown>>) {
  const headers = [...new Set(rows.flatMap((row) => Object.keys(row)))];
  const quote = (value: unknown) => `"${String(value ?? "").replaceAll('"', '""')}"`;
  return `\uFEFF${[headers, ...rows.map((row) => headers.map((key) => row[key]))].map((row) => row.map(quote).join(",")).join("\r\n")}`;
}

export async function GET(request: Request) {
  const type = new URL(request.url).searchParams.get("type") ?? "students";
  const term = await getActiveTerm();
  const range = term ? { from: term.startsOn, to: term.endsOn } : null;
  let rows: Array<Record<string, unknown>> = [];
  if (type === "students") {
    rows = (await db.select().from(students).orderBy(asc(students.seatNumber))).map((row) => ({ 座號: row.seatNumber, 姓名: row.name, 在籍: row.isActive ? "是" : "否", 建立時間: row.createdAt.toISOString() }));
  } else if (type === "homework") {
    const data = await db.select({ dueDate: homework.date, copiedDate: homework.contactBookDate, book: homeworkBooks.name, page: homework.pageLabel, student: students.name, seat: students.seatNumber, status: homeworkRecords.status, completedAt: homeworkRecords.completedAt }).from(homework)
      .innerJoin(homeworkBooks, eq(homework.bookId, homeworkBooks.id)).leftJoin(homeworkRecords, eq(homeworkRecords.homeworkId, homework.id)).leftJoin(students, eq(homeworkRecords.studentId, students.id))
      .where(range ? and(gte(homework.date, range.from), lte(homework.date, range.to)) : undefined);
    rows = data.map((row) => ({ 繳交日: row.dueDate, 抄寫日: row.copiedDate, 簿本: row.book, 頁數內容: row.page, 座號: row.seat, 姓名: row.student, 狀態: row.status ?? "未交", 完成時間: row.completedAt?.toISOString() }));
  } else if (type === "daily-tasks") {
    const data = await db.select({ date: dailyStudentTasks.taskDate, task: dailyStudentTasks.taskKey, completed: dailyStudentTasks.completed, student: students.name, seat: students.seatNumber, completedAt: dailyStudentTasks.completedAt }).from(dailyStudentTasks).innerJoin(students, eq(dailyStudentTasks.studentId, students.id))
      .where(range ? and(gte(dailyStudentTasks.taskDate, range.from), lte(dailyStudentTasks.taskDate, range.to)) : undefined);
    rows = data.map((row) => ({ 日期: row.date, 任務: row.task, 座號: row.seat, 姓名: row.student, 已完成: row.completed ? "是" : "否", 完成時間: row.completedAt?.toISOString() }));
  } else if (type === "long-tasks") {
    const [passports, readings] = await Promise.all([db.select({ type: passportRecords.type, week: passportRecords.week, status: passportRecords.status, student: students.name, seat: students.seatNumber, completedAt: passportRecords.completedAt }).from(passportRecords).innerJoin(students, eq(passportRecords.studentId, students.id)), db.select({ type: readingRecords.type, month: readingRecords.month, status: readingRecords.status, student: students.name, seat: students.seatNumber, completedAt: readingRecords.completedAt }).from(readingRecords).innerJoin(students, eq(readingRecords.studentId, students.id))]);
    rows = [...passports.map((row) => ({ 類別: `${row.type}護照`, 期間: `第${row.week}週`, 座號: row.seat, 姓名: row.student, 狀態: row.status, 完成時間: row.completedAt?.toISOString() })), ...readings.map((row) => ({ 類別: row.type === "newspaper" ? "讀報" : "閱讀心得", 期間: `${row.month}月`, 座號: row.seat, 姓名: row.student, 狀態: row.status, 完成時間: row.completedAt?.toISOString() }))];
  } else if (type === "points") {
    const data = await db.select({ student: students.name, seat: students.seatNumber, currency: gamificationLedger.currency, delta: gamificationLedger.delta, balance: gamificationLedger.balanceAfter, reason: gamificationLedger.reason, createdAt: gamificationLedger.createdAt }).from(gamificationLedger).innerJoin(students, eq(gamificationLedger.studentId, students.id)).orderBy(asc(gamificationLedger.createdAt));
    rows = data.map((row) => ({ 座號: row.seat, 姓名: row.student, 類型: row.currency, 異動: row.delta, 餘額: row.balance, 原因: row.reason, 時間: row.createdAt.toISOString() }));
  } else if (type === "shop") {
    const data = await db.select({ item: shopItems.name, student: students.name, seat: students.seatNumber, price: shopOrders.price, status: shopOrders.status, requestedAt: shopOrders.requestedAt, resolvedAt: shopOrders.resolvedAt }).from(shopOrders).innerJoin(shopItems, eq(shopOrders.itemId, shopItems.id)).innerJoin(students, eq(shopOrders.studentId, students.id));
    rows = data.map((row) => ({ 商品: row.item, 座號: row.seat, 姓名: row.student, 點數: row.price, 狀態: row.status, 申請時間: row.requestedAt.toISOString(), 處理時間: row.resolvedAt?.toISOString() }));
  } else return NextResponse.json({ error: "未知匯出類型" }, { status: 400 });
  return new NextResponse(csv(rows), { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="teacher-workspace-${type}.csv"` } });
}
