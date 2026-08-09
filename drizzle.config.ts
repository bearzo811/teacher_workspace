import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

if (!process.env.DATABASE_URL) {
  config({ path: process.env.ENV_FILE || ".env.local" });
} else {
  // 勿用 .env 覆寫已注入的 DATABASE_URL（例如 vercel env run）
  config({ path: ".env", override: false });
  config({ path: ".env.local", override: false });
}

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
  strict: true,
  verbose: true,
});
