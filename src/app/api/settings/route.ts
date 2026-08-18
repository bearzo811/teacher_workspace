import { NextResponse } from "next/server";
import { apiErrorMessage } from "@/lib/apiError";
import { SCHOOL_WEEK_MAX, SCHOOL_WEEK_MIN } from "@/lib/schoolWeek";
import {
  getClassSettings,
  updateClassSettings,
} from "@/services/classSettingsService";
import {
  gamificationRulesView,
  getGamificationSettings,
  updateGamificationSettings,
  type GamificationRulesUpdate,
} from "@/services/gamificationService";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const [data, gameSettings] = await Promise.all([
      getClassSettings(),
      getGamificationSettings(),
    ]);
    return NextResponse.json({
      data: {
        ...data,
        gamification: gamificationRulesView(gameSettings),
      },
    });
  } catch (error) {
    const message = apiErrorMessage(error, "讀取設定失敗");
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
      weekOneStartDate?: string;
      termEndDate?: string;
      allowDisplayHomeworkToggle?: boolean;
      allowDisplayPassportToggle?: boolean;
      allowDisplayRoutineToggle?: boolean;
      readingSchoolYear?: string;
      readingSemester?: string;
      allowDisplayReadingToggle?: boolean;
      displayCarouselEnabled?: boolean;
      displayToken?: string;
      displayRefreshSeconds?: number;
      displayContactBookDate?: string;
      shopOpen?: boolean;
      lunchVideoQuery?: string;
      gamification?: GamificationRulesUpdate;
    };

    if (
      body.currentWeek !== undefined &&
      (!Number.isInteger(body.currentWeek) ||
        body.currentWeek < SCHOOL_WEEK_MIN ||
        body.currentWeek > SCHOOL_WEEK_MAX)
    ) {
      return NextResponse.json(
        { error: `目前週數須為 ${SCHOOL_WEEK_MIN}～${SCHOOL_WEEK_MAX}` },
        { status: 400 },
      );
    }
    if (body.grade !== undefined && !Number.isInteger(body.grade)) {
      return NextResponse.json({ error: "年級須為整數" }, { status: 400 });
    }
    if (body.weekOneStartDate !== undefined) {
      const value = body.weekOneStartDate.trim();
      if (value !== "" && !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        return NextResponse.json(
          { error: "第一週開啟日格式須為 YYYY-MM-DD 或空白" },
          { status: 400 },
        );
      }
      body.weekOneStartDate = value;
    }
    if (body.termEndDate !== undefined) {
      const value = body.termEndDate.trim();
      if (value !== "" && !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        return NextResponse.json(
          { error: "學期結束日格式須為 YYYY-MM-DD 或空白" },
          { status: 400 },
        );
      }
      body.termEndDate = value;
    }
    if (body.weekOneStartDate !== undefined || body.termEndDate !== undefined) {
      const current = await getClassSettings();
      const start =
        body.weekOneStartDate !== undefined
          ? body.weekOneStartDate
          : current.weekOneStartDate;
      const end =
        body.termEndDate !== undefined ? body.termEndDate : current.termEndDate;
      if (start && end && end < start) {
        return NextResponse.json(
          { error: "學期結束日不可早於第一週開啟日" },
          { status: 400 },
        );
      }
    }
    if (
      body.displayContactBookDate !== undefined &&
      body.displayContactBookDate !== "" &&
      !/^\d{4}-\d{2}-\d{2}$/.test(body.displayContactBookDate)
    ) {
      return NextResponse.json(
        { error: "大屏聯絡簿日期格式須為 YYYY-MM-DD 或空白" },
        { status: 400 },
      );
    }
    if (body.lunchVideoQuery !== undefined) {
      if (typeof body.lunchVideoQuery !== "string" || body.lunchVideoQuery.length > 300) {
        return NextResponse.json({ error: "午餐影音內容不可超過 300 個字元" }, { status: 400 });
      }
      body.lunchVideoQuery = body.lunchVideoQuery.trim();
    }
    if (
      body.readingSemester !== undefined &&
      body.readingSemester !== "first" &&
      body.readingSemester !== "second"
    ) {
      return NextResponse.json(
        { error: "閱讀學期須為 first 或 second" },
        { status: 400 },
      );
    }
    for (const key of [
      "chineseStartWeek",
      "chineseEndWeek",
      "englishStartWeek",
      "englishEndWeek",
    ] as const) {
      const value = body[key];
      if (
        value !== undefined &&
        (!Number.isInteger(value) ||
          value < SCHOOL_WEEK_MIN ||
          value > SCHOOL_WEEK_MAX)
      ) {
        return NextResponse.json(
          {
            error: `${key} 須為 ${SCHOOL_WEEK_MIN}～${SCHOOL_WEEK_MAX}`,
          },
          { status: 400 },
        );
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

    if (body.gamification) {
      const game = body.gamification;
      for (const key of [
        "homeworkOnTimeCoins",
        "homeworkLateCoins",
        "passportOnTimeCoins",
        "passportLateCoins",
        "routineXp",
      ] as const) {
        const value = game[key];
        if (value !== undefined && (!Number.isInteger(value) || value < 0)) {
          return NextResponse.json(
            { error: `${key} 須為 0 以上整數` },
            { status: 400 },
          );
        }
      }
      for (const key of [
        "homeworkMissedCoins",
        "passportMissedCoins",
      ] as const) {
        const value = game[key];
        if (value !== undefined && (!Number.isInteger(value) || value > 0)) {
          return NextResponse.json(
            { error: `${key} 須為 0 以下整數` },
            { status: 400 },
          );
        }
      }
      if (
        game.levelBaseXp !== undefined &&
        (!Number.isInteger(game.levelBaseXp) || game.levelBaseXp < 1)
      ) {
        return NextResponse.json(
          { error: "levelBaseXp 須為大於 0 的整數" },
          { status: 400 },
        );
      }
    }

    const { gamification, ...classSettingsInput } = body;
    const [data, gameSettings] = await Promise.all([
      updateClassSettings(classSettingsInput),
      gamification
        ? updateGamificationSettings(gamification)
        : getGamificationSettings(),
    ]);
    return NextResponse.json({
      data: {
        ...data,
        gamification: gamificationRulesView(gameSettings),
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "更新設定失敗";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
