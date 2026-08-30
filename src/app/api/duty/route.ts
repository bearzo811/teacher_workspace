import { NextResponse } from "next/server";
import { parseDateInput } from "@/lib/dates";
import {
  clearDutyOverride,
  cancelDutySubstitution,
  completeDutyMakeup,
  confirmDutySubstitution,
  getActiveTermDutySchedule,
  getDutyDay,
  getDutySubstitutionDay,
  getDutyRange,
  listDutyMakeups,
  assignDutySubstitution,
  scheduleDutyMakeup,
  swapDutySlots,
} from "@/services/dutyService";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const date = searchParams.get("date");
    const from = searchParams.get("from");
    const to = searchParams.get("to");

    if (searchParams.get("semester") === "active") {
      const data = await getActiveTermDutySchedule();
      return NextResponse.json({ data });
    }
    if (searchParams.get("makeups") === "pending") {
      return NextResponse.json({ data: await listDutyMakeups() });
    }
    const substitutionsDate = searchParams.get("substitutions");
    if (substitutionsDate) {
      parseDateInput(substitutionsDate);
      return NextResponse.json({ data: await getDutySubstitutionDay(substitutionsDate) });
    }

    if (date) {
      parseDateInput(date);
      const data = await getDutyDay(date);
      return NextResponse.json({ data });
    }
    if (from && to) {
      parseDateInput(from);
      parseDateInput(to);
      if (to < from) {
        return NextResponse.json({ error: "結束日不可早於開始日" }, { status: 400 });
      }
      const data = await getDutyRange(from, to);
      return NextResponse.json({ data });
    }
    return NextResponse.json(
      { error: "請提供 date 或 from+to" },
      { status: 400 },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "讀取值日表失敗";
    const status = message.includes("日期") ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function PATCH(request: Request) {
  try {
    const body = (await request.json()) as {
      action?: "swap" | "clear" | "assign-substitution" | "confirm-substitution" | "cancel-substitution" | "schedule-makeup" | "complete-makeup";
      a?: { date?: string; slotKey?: string };
      b?: { date?: string; slotKey?: string };
      date?: string;
      slotKey?: string;
      id?: string;
      studentId?: string;
      assignedDate?: string;
      assignedSlotKey?: string;
    };

    if (body.action === "swap") {
      if (!body.a?.date || !body.a.slotKey || !body.b?.date || !body.b.slotKey) {
        return NextResponse.json(
          { error: "交換需要兩個格子 a、b" },
          { status: 400 },
        );
      }
      parseDateInput(body.a.date);
      parseDateInput(body.b.date);
      const data = await swapDutySlots({
        a: { date: body.a.date, slotKey: body.a.slotKey },
        b: { date: body.b.date, slotKey: body.b.slotKey },
      });
      return NextResponse.json({ data });
    }

    if (body.action === "clear") {
      if (!body.date || !body.slotKey) {
        return NextResponse.json(
          { error: "還原需要 date、slotKey" },
          { status: 400 },
        );
      }
      parseDateInput(body.date);
      const data = await clearDutyOverride({
        date: body.date,
        slotKey: body.slotKey,
      });
      return NextResponse.json({ data });
    }

    if (body.action === "assign-substitution" && body.id && body.studentId) {
      return NextResponse.json({ data: await assignDutySubstitution({ id: body.id, studentId: body.studentId }) });
    }
    if (body.action === "confirm-substitution" && body.id) {
      return NextResponse.json({ data: await confirmDutySubstitution(body.id) });
    }
    if (body.action === "cancel-substitution" && body.id) {
      return NextResponse.json({ data: await cancelDutySubstitution(body.id) });
    }
    if (body.action === "schedule-makeup" && body.id && body.assignedDate && body.assignedSlotKey) {
      parseDateInput(body.assignedDate);
      return NextResponse.json({ data: await scheduleDutyMakeup({ id: body.id, assignedDate: body.assignedDate, assignedSlotKey: body.assignedSlotKey }) });
    }
    if (body.action === "complete-makeup" && body.id) {
      return NextResponse.json({ data: await completeDutyMakeup(body.id) });
    }

    return NextResponse.json({ error: "未知 action" }, { status: 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "更新值日表失敗";
    const status =
      message.includes("請選") ||
      message.includes("放假") ||
      message.includes("無效") ||
      message.includes("人才")
        ? 400
        : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
