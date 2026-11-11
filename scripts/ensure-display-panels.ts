import { config } from "dotenv";
import { readFileSync } from "node:fs";
import postgres from "postgres";

if (!process.env.DATABASE_URL) config({ path: ".env.local", quiet: true });
const connection = process.env.DATABASE_URL;
if (!connection || connection.includes("[SENSITIVE]")) throw new Error("請提供有效的資料庫連線");
const sql = postgres(connection, { prepare: false, max: 1, connect_timeout: 30 });
async function main() {
  try {
    await sql.unsafe(readFileSync("drizzle/0035_display_hidden_panels.sql", "utf8"));
    const columns = await sql`select column_name from information_schema.columns where table_schema='public' and table_name='class_settings' and column_name='display_hidden_panels'`;
    if (columns.length !== 1) throw new Error("大屏分頁設定欄位未建立");
    console.log("大屏分頁設定欄位已備妥，既有分頁預設全部顯示。");
  } finally {
    await sql.end();
  }
}
void main().catch(() => {
  console.error("建立大屏分頁設定欄位失敗，請檢查資料庫連線與權限。");
  process.exitCode = 1;
});
