import { config } from "dotenv";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { passportRecords } from "@/db/schema";
import { getClassSettings } from "@/services/classSettingsService";
import { reconcilePassportReward } from "@/services/gamificationService";

if (!process.env.DATABASE_URL) {
  config({ path: process.env.ENV_FILE || ".env.local" });
}

/**
 * 將已提前完成的護照獎勵校正為星期一的最高獎勵。
 * reconcile 使用既有 effect key，因此可安全重跑，不會重複發放。
 */
async function main() {
  const settings = await getClassSettings();
  const currentWeek = settings.schoolWeek.week;
  if (currentWeek <= 0) {
    console.log({ currentWeek, corrected: 0, reason: "目前不在學期週次內" });
    return;
  }

  const completedRecords = await db
    .select()
    .from(passportRecords)
    .where(
      eq(passportRecords.status, "completed"),
    );

  const earlyRecords = completedRecords.filter((record) => record.week > currentWeek);
  for (const record of earlyRecords) {
    await reconcilePassportReward({
      studentId: record.studentId,
      type: record.type,
      week: record.week,
      completed: true,
      completedAt: record.completedAt,
      isPastWeek: false,
      isFutureWeek: true,
    });
  }

  console.log({ currentWeek, corrected: earlyRecords.length });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
