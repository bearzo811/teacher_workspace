import { setReturnDay } from "@/services/calendarService";

const [date, value = "true"] = process.argv.slice(2);
if (!date) {
  throw new Error("用法：tsx scripts/set-return-day.ts YYYY-MM-DD [true|false]");
}

async function main() {
  const isReturnDay = value !== "false";
  const result = await setReturnDay({ date, isReturnDay });
  console.log(`返校日已${result.isReturnDay ? "啟用" : "取消"}：${result.date}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
