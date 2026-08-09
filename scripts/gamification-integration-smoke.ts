import { config } from "dotenv";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import {
  dailyStudentTasks,
  gamificationEffects,
  gamificationLedger,
  studentGameProfiles,
  students,
} from "@/db/schema";
import { taipeiDateString } from "@/lib/gamification";
import { upsertDailyStudentTask } from "@/services/routineService";

if (!process.env.DATABASE_URL) {
  config({ path: process.env.ENV_FILE || ".env.local" });
}

async function cleanup(studentId: string) {
  await db
    .delete(gamificationLedger)
    .where(eq(gamificationLedger.studentId, studentId));
  await db
    .delete(gamificationEffects)
    .where(eq(gamificationEffects.studentId, studentId));
  await db
    .delete(studentGameProfiles)
    .where(eq(studentGameProfiles.studentId, studentId));
  await db
    .delete(dailyStudentTasks)
    .where(eq(dailyStudentTasks.studentId, studentId));
  await db.delete(students).where(eq(students.id, studentId));
}

async function main() {
  const [student] = await db
    .insert(students)
    .values({
      name: "__gamification_smoke__",
      seatNumber: 9999,
      isActive: true,
    })
    .returning();
  try {
    const taskDate = taipeiDateString();
    await upsertDailyStudentTask({
      studentId: student.id,
      taskKey: "morning_cleaning",
      completed: true,
      taskDate,
    });
    await upsertDailyStudentTask({
      studentId: student.id,
      taskKey: "morning_cleaning",
      completed: true,
      taskDate,
    });
    await upsertDailyStudentTask({
      studentId: student.id,
      taskKey: "morning_cleaning",
      completed: false,
      taskDate,
    });

    const [profile] = await db
      .select()
      .from(studentGameProfiles)
      .where(eq(studentGameProfiles.studentId, student.id));
    const ledger = await db
      .select({ delta: gamificationLedger.delta })
      .from(gamificationLedger)
      .where(eq(gamificationLedger.studentId, student.id));
    const deltas = ledger.map((row) => row.delta).sort((a, b) => a - b);
    if (profile.xpTotal !== 0 || deltas.join(",") !== "-2,2") {
      throw new Error(
        `冪等／回沖驗證失敗: xp=${profile.xpTotal}, deltas=${deltas.join(",")}`,
      );
    }
    console.log({ ok: true, xpTotal: profile.xpTotal, deltas });
  } finally {
    await cleanup(student.id);
  }
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
