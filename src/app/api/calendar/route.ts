import { NextResponse } from "next/server";
import {
  createCalendarEvent,
  deleteCalendarEvent,
  listCalendarEventsByDate,
  listCalendarEventsInRange,
  listHolidayOverridesInRange,
  listReturnDaysInRange,
  setDayHoliday,
  setReturnDay,
  updateCalendarEvent,
} from "@/services/calendarService";
import { resolveIsHoliday } from "@/types/calendar";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const date = searchParams.get("date");
    const from = searchParams.get("from");
    const to = searchParams.get("to");

    if (date) {
      const [data, overrides, returnDays] = await Promise.all([
        listCalendarEventsByDate(date),
        listHolidayOverridesInRange(date, date),
        listReturnDaysInRange(date, date),
      ]);
      return NextResponse.json({
        data,
        holidayOverrides: overrides,
        isHoliday: resolveIsHoliday(date, overrides),
        isReturnDay: Boolean(returnDays[date]),
      });
    }
    if (from && to) {
      const [data, holidayOverrides, returnDays] = await Promise.all([
        listCalendarEventsInRange(from, to),
        listHolidayOverridesInRange(from, to),
        listReturnDaysInRange(from, to),
      ]);
      return NextResponse.json({ data, holidayOverrides, returnDays });
    }
    return NextResponse.json(
      { error: "請提供 date，或 from 與 to" },
      { status: 400 },
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "讀取行事曆失敗";
    const status = message.includes("日期") ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      date?: string;
      title?: string;
      allDay?: boolean;
      startTime?: string | null;
      endTime?: string | null;
      sortOrder?: number;
      /** 若帶 isHoliday，改設放假日而非新增活動 */
      isHoliday?: boolean;
      action?: "set_holiday" | "set_return_day";
      isReturnDay?: boolean;
    };

    if (
      body.action === "set_holiday" ||
      (typeof body.isHoliday === "boolean" && body.title === undefined)
    ) {
      if (!body.date || typeof body.isHoliday !== "boolean") {
        return NextResponse.json(
          { error: "請提供 date 與 isHoliday" },
          { status: 400 },
        );
      }
      const data = await setDayHoliday({
        date: body.date,
        isHoliday: body.isHoliday,
      });
      return NextResponse.json({ data });
    }

    if (body.action === "set_return_day") {
      if (!body.date || typeof body.isReturnDay !== "boolean") {
        return NextResponse.json({ error: "請提供 date 與 isReturnDay" }, { status: 400 });
      }
      return NextResponse.json({ data: await setReturnDay({ date: body.date, isReturnDay: body.isReturnDay }) });
    }

    if (!body.date || typeof body.title !== "string") {
      return NextResponse.json(
        { error: "請提供 date 與 title" },
        { status: 400 },
      );
    }
    const data = await createCalendarEvent({
      date: body.date,
      title: body.title,
      allDay: body.allDay !== false,
      startTime: body.startTime,
      endTime: body.endTime,
      sortOrder: body.sortOrder,
    });
    return NextResponse.json({ data });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "新增活動失敗";
    const status =
      message.includes("日期") ||
      message.includes("時間") ||
      message.includes("填寫")
        ? 400
        : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function PATCH(request: Request) {
  try {
    const body = (await request.json()) as {
      id?: string;
      date?: string;
      title?: string;
      allDay?: boolean;
      startTime?: string | null;
      endTime?: string | null;
      sortOrder?: number;
      isHoliday?: boolean;
      action?: "set_holiday" | "set_return_day";
      isReturnDay?: boolean;
    };

    if (body.action === "set_holiday" || (body.isHoliday !== undefined && !body.id)) {
      if (!body.date || typeof body.isHoliday !== "boolean") {
        return NextResponse.json(
          { error: "請提供 date 與 isHoliday" },
          { status: 400 },
        );
      }
      const data = await setDayHoliday({
        date: body.date,
        isHoliday: body.isHoliday,
      });
      return NextResponse.json({ data });
    }

    if (body.action === "set_return_day") {
      if (!body.date || typeof body.isReturnDay !== "boolean") {
        return NextResponse.json({ error: "請提供 date 與 isReturnDay" }, { status: 400 });
      }
      return NextResponse.json({ data: await setReturnDay({ date: body.date, isReturnDay: body.isReturnDay }) });
    }

    if (!body.id) {
      return NextResponse.json({ error: "請提供 id" }, { status: 400 });
    }
    const data = await updateCalendarEvent({
      id: body.id,
      date: body.date,
      title: body.title,
      allDay: body.allDay,
      startTime: body.startTime,
      endTime: body.endTime,
      sortOrder: body.sortOrder,
    });
    return NextResponse.json({ data });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "更新活動失敗";
    const status =
      message.includes("日期") ||
      message.includes("時間") ||
      message.includes("填寫") ||
      message.includes("找不到")
        ? 400
        : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "請提供 id" }, { status: 400 });
    }
    await deleteCalendarEvent(id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "刪除活動失敗";
    const status = message.includes("找不到") ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
