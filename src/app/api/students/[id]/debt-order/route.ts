import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { studentDebtOrders, students } from "@/db/schema";
import { getDisplayData } from "@/services/displayService";
import { touchDisplayVersion } from "@/services/classSettingsService";

export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string }> };
export async function GET(_request: Request, context: Context) {
  const { id } = await context.params;
  const data = await getDisplayData();
  const row = data.debts.find((item) => item.studentId === id);
  if (!row) return NextResponse.json({ error: "找不到學生" }, { status: 404 });
  return NextResponse.json({ items: row.priorityItems });
}
export async function PUT(request: Request, context: Context) {
  try {
    const { id } = await context.params;
    const { keys } = await request.json();
    if (!Array.isArray(keys) || keys.length > 2000 || keys.some((key) => typeof key !== "string" || key.length > 200) || new Set(keys).size !== keys.length) {
      return NextResponse.json({ error: "排序資料格式不正確" }, { status: 400 });
    }
    const [student] = await db.select({ id: students.id }).from(students).where(eq(students.id, id));
    if (!student) return NextResponse.json({ error: "找不到學生" }, { status: 404 });
    await db.insert(studentDebtOrders).values({ studentId: id, itemKeys: JSON.stringify(keys) })
      .onConflictDoUpdate({ target: studentDebtOrders.studentId, set: { itemKeys: JSON.stringify(keys) } });
    await touchDisplayVersion();
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "儲存排序失敗，請重試" }, { status: 500 });
  }
}
