/**
 * 在 DATABASE_URL 指向的 DB 上補齊 class_settings 欄位（等同 ensure_class_settings_columns.sql）
 * 用法：npx vercel env run --environment=production -- npx tsx scripts/ensure-class-settings-columns.ts
 */
import { config } from "dotenv";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import postgres from "postgres";

if (!process.env.DATABASE_URL) {
  config({ path: process.env.ENV_FILE || ".env.local" });
}

const url = process.env.DATABASE_URL;
if (!url || url.includes("[SENSITIVE]")) {
  console.error(
    "DATABASE_URL 無效。請用：npx vercel env run --environment=production -- npx tsx scripts/ensure-class-settings-columns.ts",
  );
  process.exit(1);
}

const sqlPath = join(process.cwd(), "drizzle/ensure_class_settings_columns.sql");
const statements = readFileSync(sqlPath, "utf8")
  .split("\n")
  .map((l) => l.trim())
  .filter((l) => l && !l.startsWith("--"));

const sql = postgres(url, {
  prepare: false,
  max: 1,
  idle_timeout: 20,
  connect_timeout: 30,
});

async function main() {
  for (const stmt of statements) {
    console.log("→", stmt.slice(0, 72) + "...");
    await sql.unsafe(stmt);
  }

  const cols = await sql`
    SELECT column_name FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'class_settings'
    ORDER BY ordinal_position
  `;
  console.log("\nOK. class_settings 共", cols.length, "欄");
  const need = ["week_one_start_date", "term_end_date", "display_contact_book_date"];
  for (const c of need) {
    if (!cols.some((r) => r.column_name === c)) {
      console.error("仍缺欄位:", c);
      process.exit(1);
    }
  }
  await sql.end({ timeout: 10 });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
