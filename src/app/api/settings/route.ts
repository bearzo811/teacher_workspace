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
      allowDisplayHomeworkToggle?: boolean;
      allowDisplayPassportToggle?: boolean;
      displayCarouselEnabled?: boolean;
      displayToken?: string;
      displayRefreshSeconds?: number;
    };

    if (
      body.currentWeek !== undefined &&
      (!Number.isInteger(body.currentWeek) || body.currentWeek < 1)
    ) {
      return NextResponse.json({ error: "目前週數無效" }, { status: 400 });
    }
    if (body.grade !== undefined && !Number.isInteger(body.grade)) {
      return NextResponse.json({ error: "年級須為整數" }, { status: 400 });
    }
    for (const key of [
      "chineseStartWeek",
      "chineseEndWeek",
      "englishStartWeek",
      "englishEndWeek",
    ] as const) {
      const value = body[key];
      if (value !== undefined && (!Number.isInteger(value) || value < 1)) {
        return NextResponse.json({ error: `${key} 無效` }, { status: 400 });
      }
    }
    if (
      body.displayRefreshSeconds !== undefined &&
      (!Number.isInteger(body.displayRefreshSeconds) ||
        body.displayRefreshSeconds < 5)
    ) {
      return NextResponse.json(
        { error: "大屏刷新秒數至少 5 秒" },
        { status: 400 },
      );
    }

    const data = await updateClassSettings(body);
    return NextResponse.json({ data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "更新設定失敗";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
