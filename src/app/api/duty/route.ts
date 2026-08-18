import { NextResponse } from "next/server";
import { parseDateInput } from "@/lib/dates";
import {
  clearDutyOverride,
  getActiveTermDutySchedule,
  getDutyDay,
  getDutyRange,
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
      action?: "swap" | "clear";
      a?: { date?: string; slotKey?: string };
      b?: { date?: string; slotKey?: string };
      date?: string;
      slotKey?: string;
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
