import { NextResponse } from "next/server";
import {
  getClassSettings,
  updateClassSettings,
} from "@/services/classSettingsService";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const data = await getClassSettings();
    return NextResponse.json({ data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "讀取設定失敗";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const body = (await request.json()) as {
      currentWeek?: number;
      schoolYear?: string;
      grade?: number;
      className?: string;
      chineseStartWeek?: number;
      chineseEndWeek?: number;
      englishStartWeek?: number;
      englishEndWeek?: number;
    };

    if (
      body.currentWeek !== undefined &&
      (!Number.isInteger(body.currentWeek) || body.currentWeek < 1)
    ) {
      return NextResponse.json({ error: "目前週數無效" }, { status: 400 });
    }

    const data = await updateClassSettings(body);
    return NextResponse.json({ data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "更新設定失敗";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
