import { and, desc, eq, gte, inArray, lt, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  gamificationEffects,
  gamificationLedger,
  gamificationSettings,
  homework,
  homeworkRecords,
  passportRecords,
  studentGameProfiles,
  students,
  type GamificationSettings,
} from "@/db/schema";
import {
  addCalendarDays,
  displayCoins,
  effectKey,
  gamificationProgress,
  isCompletedOnTime,
  taipeiDateString,
} from "@/lib/gamification";
import { resolveSchoolWeek } from "@/lib/schoolWeek";
import { getClassSettings } from "@/services/classSettingsService";
import type {
  GameCurrency,
  GamificationLedgerView,
  GamificationRulesView,
  GamificationView,
} from "@/types/gamification";

const SETTINGS_ID = "default";

export type GamificationRulesUpdate = Partial<
  Pick<
    GamificationSettings,
    | "homeworkOnTimeCoins"
    | "homeworkLateCoins"
    | "homeworkMissedCoins"
    | "passportOnTimeCoins"
    | "passportLateCoins"
    | "passportMissedCoins"
    | "routineXp"
    | "levelBaseXp"
  >
>;

export async function getGamificationSettings() {
  const [settings] = await db
    .select()
    .from(gamificationSettings)
    .where(eq(gamificationSettings.id, SETTINGS_ID))
    .limit(1);
  if (settings) return settings;
  const [created] = await db
    .insert(gamificationSettings)
    .values({ id: SETTINGS_ID })
    .onConflictDoUpdate({
      target: gamificationSettings.id,
      set: { id: SETTINGS_ID },
    })
    .returning();
  return created;
}

export async function updateGamificationSettings(
  input: GamificationRulesUpdate,
) {
  await getGamificationSettings();
  const [settings] = await db
    .update(gamificationSettings)
    .set({ ...input, updatedAt: new Date() })
    .where(eq(gamificationSettings.id, SETTINGS_ID))
    .returning();
  return settings;
}

export async function ensureStudentGameProfile(studentId: string) {
  await db
    .insert(studentGameProfiles)
    .values({ studentId })
    .onConflictDoNothing();
}

export function gamificationRulesView(
  settings: GamificationSettings,
): GamificationRulesView {
  return {
    enabledAt: settings.enabledAt.toISOString(),
    homeworkOnTimeCoins: settings.homeworkOnTimeCoins,
    homeworkLateCoins: settings.homeworkLateCoins,
    homeworkMissedCoins: settings.homeworkMissedCoins,
    passportOnTimeCoins: settings.passportOnTimeCoins,
    passportLateCoins: settings.passportLateCoins,
    passportMissedCoins: settings.passportMissedCoins,
    routineXp: settings.routineXp,
    levelBaseXp: settings.levelBaseXp,
  };
}

type SetEffectInput = {
  effectKey: string;
  studentId: string;
  currency: GameCurrency;
  sourceType: string;
  sourceId: string;
  effectType: string;
  amount: number;
  reason: string;
  ruleSnapshot?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
};

/**
 * 將來源的「目前應生效金額」調整為 amount。
 * advisory lock + effect PK 讓老師端、大屏與 cron 同時重送仍只結算一次。
 */
export async function setGamificationEffect(input: SetEffectInput) {
  const desiredAmount = Math.trunc(input.amount);
  return db.transaction(async (tx) => {
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtext(${input.effectKey}))`,
    );
    await tx
      .insert(studentGameProfiles)
      .values({ studentId: input.studentId })
      .onConflictDoNothing();

    const [existing] = await tx
      .select({ amount: gamificationEffects.amount })
      .from(gamificationEffects)
      .where(eq(gamificationEffects.effectKey, input.effectKey))
      .limit(1);
    // 規則改動只影響下一次由 0 啟用的效果；已生效事件不追溯重算。
    const targetAmount =
      existing && existing.amount !== 0 && desiredAmount !== 0
        ? existing.amount
        : desiredAmount;
    const delta = targetAmount - (existing?.amount ?? 0);
    if (delta === 0) return { delta: 0 };

    const now = new Date();
    const [profile] =
      input.currency === "xp"
        ? await tx
            .update(studentGameProfiles)
            .set({
              xpTotal: sql`${studentGameProfiles.xpTotal} + ${delta}`,
              updatedAt: now,
            })
            .where(eq(studentGameProfiles.studentId, input.studentId))
            .returning()
        : await tx
            .update(studentGameProfiles)
            .set({
              coinNet: sql`${studentGameProfiles.coinNet} + ${delta}`,
              updatedAt: now,
            })
            .where(eq(studentGameProfiles.studentId, input.studentId))
            .returning();

    const snapshot = JSON.stringify(input.ruleSnapshot ?? {});
    if (existing) {
      await tx
        .update(gamificationEffects)
        .set({
          amount: targetAmount,
          ruleSnapshot: snapshot,
          updatedAt: now,
        })
        .where(eq(gamificationEffects.effectKey, input.effectKey));
    } else {
      await tx.insert(gamificationEffects).values({
        effectKey: input.effectKey,
        studentId: input.studentId,
        currency: input.currency,
        sourceType: input.sourceType,
        sourceId: input.sourceId,
        effectType: input.effectType,
        amount: targetAmount,
        ruleSnapshot: snapshot,
      });
    }

    const balanceAfter =
      input.currency === "xp" ? profile.xpTotal : profile.coinNet;
    await tx.insert(gamificationLedger).values({
      studentId: input.studentId,
      effectKey: input.effectKey,
      currency: input.currency,
      delta,
      balanceAfter,
      reason: input.reason,
      metadata: JSON.stringify(input.metadata ?? {}),
    });
    return { delta, balanceAfter };
  });
}

/** 老師手動加／扣金幣：每次是一筆不可變更帳本紀錄，原因必填。 */
export async function addManualCoins(input: {
  studentId: string;
  amount: number;
  reason: string;
}) {
  const reason = input.reason.trim();
  if (!reason) throw new Error("手動調整必須填寫原因");
  if (!Number.isInteger(input.amount) || input.amount === 0) {
    throw new Error("調整點數必須是非 0 整數");
  }
  return setGamificationEffect({
    effectKey: `manual:${crypto.randomUUID()}`,
    studentId: input.studentId,
    currency: "coins",
    sourceType: "manual",
    sourceId: crypto.randomUUID(),
    effectType: "adjustment",
    amount: input.amount,
    reason,
  });
}

export async function getEffectAmount(key: string) {
  const [row] = await db
    .select({ amount: gamificationEffects.amount })
    .from(gamificationEffects)
    .where(eq(gamificationEffects.effectKey, key))
    .limit(1);
  return row?.amount ?? 0;
}

function isAfterLaunch(settings: GamificationSettings, date: Date) {
  return date.getTime() >= settings.enabledAt.getTime();
}

function sourceIsAfterLaunch(
  settings: GamificationSettings,
  sourceDate: string,
) {
  return sourceDate >= taipeiDateString(settings.enabledAt);
}

export async function reconcileHomeworkReward(input: {
  studentId: string;
  homeworkId: string;
  dueDate: string;
  completed: boolean;
  completedAt: Date | null;
}) {
  const settings = await getGamificationSettings();
  const key = effectKey(
    "homework",
    input.homeworkId,
    input.studentId,
    "completion",
  );
  if (
    !sourceIsAfterLaunch(settings, input.dueDate) ||
    (input.completedAt && !isAfterLaunch(settings, input.completedAt))
  ) {
    return setGamificationEffect({
      effectKey: key,
      studentId: input.studentId,
      currency: "coins",
      sourceType: "homework",
      sourceId: input.homeworkId,
      effectType: "completion",
      amount: 0,
      reason: "作業完成回沖",
    });
  }
  const penalty = await getEffectAmount(
    effectKey("homework", input.homeworkId, input.studentId, "missed"),
  );
  const onTime =
    input.completedAt !== null &&
    penalty === 0 &&
    isCompletedOnTime(input.completedAt, input.dueDate);
  const amount = !input.completed
    ? 0
    : onTime
      ? settings.homeworkOnTimeCoins
      : settings.homeworkLateCoins;
  return setGamificationEffect({
    effectKey: key,
    studentId: input.studentId,
    currency: "coins",
    sourceType: "homework",
    sourceId: input.homeworkId,
    effectType: "completion",
    amount,
    reason:
      amount === 0 ? "作業完成回沖" : onTime ? "準時完成作業" : "逾期補交作業",
    ruleSnapshot: {
      onTime: settings.homeworkOnTimeCoins,
      late: settings.homeworkLateCoins,
    },
    metadata: { dueDate: input.dueDate },
  });
}

export async function reconcilePassportReward(input: {
  studentId: string;
  type: "Chinese" | "English";
  week: number;
  completed: boolean;
  completedAt: Date | null;
  isPastWeek: boolean;
}) {
  const settings = await getGamificationSettings();
  const sourceId = `${input.type}:${input.week}`;
  const key = effectKey(
    "passport",
    input.type,
    input.week,
    input.studentId,
    "completion",
  );
  if (input.completedAt && !isAfterLaunch(settings, input.completedAt)) return;
  const penalty = await getEffectAmount(
    effectKey("passport", input.type, input.week, input.studentId, "missed"),
  );
  const late = input.isPastWeek || penalty < 0;
  const amount = !input.completed
    ? 0
    : late
      ? settings.passportLateCoins
      : settings.passportOnTimeCoins;
  await setGamificationEffect({
    effectKey: key,
    studentId: input.studentId,
    currency: "coins",
    sourceType: "passport",
    sourceId,
    effectType: "completion",
    amount,
    reason:
      amount === 0 ? "護照完成回沖" : late ? "逾期補完護照" : "準時完成護照",
    ruleSnapshot: {
      onTime: settings.passportOnTimeCoins,
      late: settings.passportLateCoins,
    },
    metadata: { type: input.type, week: input.week },
  });
}

/** v2 學期護照完成／退回的點數效果。 */
export async function reconcileTermPassportReward(input: {
  studentId: string;
  termId: string;
  type: "Chinese" | "English";
  completed: boolean;
}) {
  const settings = await getGamificationSettings();
  const sourceId = `${input.termId}:${input.type}`;
  return setGamificationEffect({
    effectKey: effectKey("term-passport", input.termId, input.type, input.studentId),
    studentId: input.studentId,
    currency: "coins",
    sourceType: "term-passport",
    sourceId,
    effectType: "completion",
    amount: input.completed ? settings.passportOnTimeCoins : 0,
    reason: input.completed ? "完成學期護照" : "學期護照退回",
    ruleSnapshot: { completed: settings.passportOnTimeCoins },
    metadata: { termId: input.termId, type: input.type },
  });
}

export async function reconcileRoutineReward(input: {
  studentId: string;
  taskDate: string;
  taskKey: string;
  completed: boolean;
}) {
  const settings = await getGamificationSettings();
  if (!sourceIsAfterLaunch(settings, input.taskDate)) return;
  await setGamificationEffect({
    effectKey: effectKey(
      "routine",
      input.taskDate,
      input.taskKey,
      input.studentId,
    ),
    studentId: input.studentId,
    currency: "xp",
    sourceType: "routine",
    sourceId: `${input.taskDate}:${input.taskKey}`,
    effectType: "completion",
    amount: input.completed ? settings.routineXp : 0,
    reason: input.completed ? "完成生活習慣" : "生活習慣回沖",
    ruleSnapshot: { xp: settings.routineXp },
    metadata: { taskDate: input.taskDate, taskKey: input.taskKey },
  });
  // 同一完成事件同時提供可用點數，讓每日任務可用於商店；XP 仍用來計算等級。
  await setGamificationEffect({
    effectKey: effectKey("routine-coins", input.taskDate, input.taskKey, input.studentId),
    studentId: input.studentId,
    currency: "coins",
    sourceType: "routine-coins",
    sourceId: `${input.taskDate}:${input.taskKey}`,
    effectType: "completion",
    amount: input.completed ? settings.routineXp : 0,
    reason: input.completed ? "完成每日任務" : "每日任務退回",
    ruleSnapshot: { coins: settings.routineXp },
    metadata: { taskDate: input.taskDate, taskKey: input.taskKey },
  });
}

export async function clearGamificationEffectsForSource(
  sourceType: string,
  sourceId: string,
) {
  const effects = await db
    .select()
    .from(gamificationEffects)
    .where(
      sql`${gamificationEffects.sourceType} = ${sourceType} and ${gamificationEffects.sourceId} = ${sourceId}`,
    );
  for (const effect of effects) {
    await setGamificationEffect({
      effectKey: effect.effectKey,
      studentId: effect.studentId,
      currency: effect.currency,
      sourceType: effect.sourceType,
      sourceId: effect.sourceId,
      effectType: effect.effectType,
      amount: 0,
      reason: "來源刪除回沖",
    });
  }
}

function profileView(
  profile: { xpTotal: number; coinNet: number },
  levelBaseXp: number,
): GamificationView {
  return {
    ...gamificationProgress(profile.xpTotal, levelBaseXp),
    coins: displayCoins(profile.coinNet),
  };
}

export async function getGamificationForStudents(studentIds: string[]) {
  if (studentIds.length === 0) return new Map<string, GamificationView>();
  const settings = await getGamificationSettings();
  const profiles = await db
    .select()
    .from(studentGameProfiles)
    .where(inArray(studentGameProfiles.studentId, studentIds));
  const profileMap = new Map(
    profiles.map((profile) => [profile.studentId, profile]),
  );
  return new Map(
    studentIds.map((studentId) => {
      const profile = profileMap.get(studentId) ?? { xpTotal: 0, coinNet: 0 };
      return [studentId, profileView(profile, settings.levelBaseXp)];
    }),
  );
}

export async function getStudentGamification(studentId: string) {
  const [settings, profileRows, ledger] = await Promise.all([
    getGamificationSettings(),
    db
      .select()
      .from(studentGameProfiles)
      .where(eq(studentGameProfiles.studentId, studentId))
      .limit(1),
    db
      .select()
      .from(gamificationLedger)
      .where(eq(gamificationLedger.studentId, studentId))
      .orderBy(desc(gamificationLedger.createdAt))
      .limit(20),
  ]);
  const profile = profileRows[0] ?? { xpTotal: 0, coinNet: 0 };
  const recent: GamificationLedgerView[] = ledger.map((row) => ({
    id: row.id,
    currency: row.currency,
    delta: row.delta,
    balanceAfter:
      row.currency === "coins"
        ? displayCoins(row.balanceAfter)
        : Math.max(0, row.balanceAfter),
    reason: row.reason,
    createdAt: row.createdAt.toISOString(),
  }));
  return {
    profile: profileView(profile, settings.levelBaseXp),
    recent,
  };
}

function calendarWeekday(dateString: string) {
  const [year, month, day] = dateString.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

function mostRecentEndedSunday(today: string) {
  const yesterday = addCalendarDays(today, -1);
  return addCalendarDays(yesterday, -calendarWeekday(yesterday));
}

async function settleHomeworkPenalties(
  now: Date,
  settings: GamificationSettings,
) {
  const today = taipeiDateString(now);
  const enabledDate = taipeiDateString(settings.enabledAt);
  const [assignments, activeStudents] = await Promise.all([
    db
      .select({ id: homework.id, dueDate: homework.date })
      .from(homework)
      .where(and(gte(homework.date, enabledDate), lt(homework.date, today))),
    db
      .select({ studentId: students.id })
      .from(students)
      .where(eq(students.isActive, true)),
  ]);
  if (assignments.length === 0 || activeStudents.length === 0) return 0;

  const records = await db
    .select()
    .from(homeworkRecords)
    .where(
      inArray(
        homeworkRecords.homeworkId,
        assignments.map((item) => item.id),
      ),
    );
  const recordMap = new Map(
    records.map((row) => [`${row.homeworkId}:${row.studentId}`, row]),
  );
  let changed = 0;
  for (const assignment of assignments) {
    const dueDate = String(assignment.dueDate);
    for (const student of activeStudents) {
      const record = recordMap.get(`${assignment.id}:${student.studentId}`);
      const completedOnTime = Boolean(
        record?.completed &&
        record.completedAt &&
        isCompletedOnTime(record.completedAt, dueDate),
      );
      const result = await setGamificationEffect({
        effectKey: effectKey(
          "homework",
          assignment.id,
          student.studentId,
          "missed",
        ),
        studentId: student.studentId,
        currency: "coins",
        sourceType: "homework",
        sourceId: assignment.id,
        effectType: "missed",
        amount: completedOnTime ? 0 : settings.homeworkMissedCoins,
        reason: completedOnTime ? "作業逾期扣款回沖" : "作業逾期未完成",
        ruleSnapshot: { missed: settings.homeworkMissedCoins },
        metadata: { dueDate },
      });
      if (result.delta !== 0) changed += 1;
    }
  }
  return changed;
}

async function settlePassportPenalties(
  now: Date,
  settings: GamificationSettings,
) {
  const classSettings = await getClassSettings();
  const today = taipeiDateString(now);
  const deadlineDate = mostRecentEndedSunday(today);
  if (deadlineDate < taipeiDateString(settings.enabledAt)) return 0;

  const deadlineWeek = resolveSchoolWeek({
    weekOneStartDate: classSettings.weekOneStartDate,
    termEndDate: classSettings.termEndDate,
    fallbackWeek: classSettings.currentWeek,
    today: deadlineDate,
  }).week;
  if (deadlineWeek < 1) return 0;

  const activeTypes = [
    {
      type: "Chinese" as const,
      start: classSettings.chineseStartWeek,
      end: classSettings.chineseEndWeek,
    },
    {
      type: "English" as const,
      start: classSettings.englishStartWeek,
      end: classSettings.englishEndWeek,
    },
  ].filter(({ start, end }) => deadlineWeek >= start && deadlineWeek <= end);
  if (activeTypes.length === 0) return 0;

  const activeStudents = await db
    .select({ studentId: students.id })
    .from(students)
    .where(eq(students.isActive, true));
  let changed = 0;
  for (const { type } of activeTypes) {
    const records = await db
      .select()
      .from(passportRecords)
      .where(
        and(
          eq(passportRecords.type, type),
          eq(passportRecords.week, deadlineWeek),
        ),
      );
    const recordMap = new Map(records.map((row) => [row.studentId, row]));
    for (const student of activeStudents) {
      const record = recordMap.get(student.studentId);
      const completedOnTime = Boolean(
        record?.status === "completed" &&
        record.completedAt &&
        isCompletedOnTime(record.completedAt, deadlineDate),
      );
      const result = await setGamificationEffect({
        effectKey: effectKey(
          "passport",
          type,
          deadlineWeek,
          student.studentId,
          "missed",
        ),
        studentId: student.studentId,
        currency: "coins",
        sourceType: "passport",
        sourceId: `${type}:${deadlineWeek}`,
        effectType: "missed",
        amount: completedOnTime ? 0 : settings.passportMissedCoins,
        reason: completedOnTime ? "護照逾期扣款回沖" : "護照逾期未完成",
        ruleSnapshot: { missed: settings.passportMissedCoins },
        metadata: { type, week: deadlineWeek, deadlineDate },
      });
      if (result.delta !== 0) changed += 1;
    }
  }
  return changed;
}

export async function settleGamificationOverdue(now = new Date()) {
  const settings = await getGamificationSettings();
  const [homeworkChanged, passportChanged] = await Promise.all([
    settleHomeworkPenalties(now, settings),
    settlePassportPenalties(now, settings),
  ]);
  return { homeworkChanged, passportChanged };
}
