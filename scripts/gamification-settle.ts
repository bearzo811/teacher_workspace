import { config } from "dotenv";
import { settleGamificationOverdue } from "@/services/gamificationService";

if (!process.env.DATABASE_URL) {
  config({ path: process.env.ENV_FILE || ".env.local" });
}

async function main() {
  const result = await settleGamificationOverdue();
  console.log(result);
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
