/** 列出 class_settings 欄位 + drizzle migration 紀錄 */
import { config } from "dotenv";
import postgres from "postgres";

config({ path: process.env.ENV_FILE || ".env.local" });

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL 未設定");
  process.exit(1);
}

const sql = postgres(url, { prepare: false, max: 1, idle_timeout: 5, connect_timeout: 15 });

async function main() {
  const cols = await sql`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'class_settings'
    ORDER BY ordinal_position
  `;
  console.log("class_settings columns:", cols.map((r) => r.column_name).join(", ") || "(none)");

  const mig = await sql`
    SELECT id, hash, created_at FROM drizzle.__drizzle_migrations ORDER BY created_at
  `.catch(() => null);
  if (mig) {
    console.log("drizzle migrations count:", mig.length);
    console.log("last:", mig[mig.length - 1]?.id);
  } else {
    console.log("drizzle.__drizzle_migrations: (missing or no access)");
  }

  const one = await sql`SELECT id, class_name FROM class_settings LIMIT 1`.catch((e) => ({
    err: String(e),
  }));
  if ("err" in one) console.log("select class_settings:", one.err);
  else console.log("class_settings row:", one[0]?.class_name ?? "(empty)");

  await sql.end({ timeout: 5 });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
