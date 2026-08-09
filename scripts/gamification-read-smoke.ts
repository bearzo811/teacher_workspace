import { config } from "dotenv";
import { listStudents, getStudentDetail } from "@/services/studentService";

if (!process.env.DATABASE_URL) {
  config({ path: process.env.ENV_FILE || ".env.local" });
}

async function main() {
  const [student] = await listStudents();
  if (!student) throw new Error("沒有學生可測試");
  const detail = await getStudentDetail(student.id);
  console.log({
    studentId: student.id,
    gamification: detail?.gamification,
    recentCount: detail?.gamificationRecent.length,
  });
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
