import { config } from "dotenv";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { readingRecords } from "@/db/schema";
import {
  getGamificationSettings,
  setGamificationEffect,
} from "@/services/gamificationService";
import { effectKey } from "@/lib/gamification";

if (!process.env.DATABASE_URL) {
  config({ path: process.env.ENV_FILE || ".env.local" });
}

/**
 * 一次性補發既有讀報／閱讀心得的完成金幣。
 * effectKey 與日後一般完成事件相同，因此可安全重跑、不會重複發放。
 */
async function main() {
  const [settings, completedRecords] = await Promise.all([
    getGamificationSettings(),
    db
      .select()
      .from(readingRecords)
      .where(eq(readingRecords.status, "completed")),
  ]);

  let granted = 0;
  for (const record of completedRecords) {
    const sourceId = `${record.type}:${record.schoolYear}:${record.semester}:${record.month}`;
    const amount =
      record.type === "newspaper"
        ? settings.readingNewspaperCoins
        : settings.readingReflectionCoins;
    const result = await setGamificationEffect({
      effectKey: effectKey("reading", sourceId, record.studentId, "completion"),
      studentId: record.studentId,
      currency: "coins",
      sourceType: "reading",
      sourceId,
      effectType: "completion",
      amount,
      reason:
        record.type === "newspaper"
          ? "既有完成讀報補發"
          : "既有完成閱讀心得補發",
      ruleSnapshot: { coins: amount, backfill: true },
      metadata: {
        type: record.type,
        month: record.month,
        schoolYear: record.schoolYear,
        semester: record.semester,
        backfill: true,
      },
    });
    if (result.delta !== 0) granted += 1;
  }

  console.log({ completedRecords: completedRecords.length, granted });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
