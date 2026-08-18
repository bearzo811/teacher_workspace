import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "@/db/schema";

export type Database = PostgresJsDatabase<typeof schema>;

const globalForDb = globalThis as unknown as {
  __teacherWorkspaceSql?: ReturnType<typeof postgres>;
  __teacherWorkspaceDb?: Database;
};

function createDb(): Database {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      "DATABASE_URL is not set. Copy .env.example to .env.local and paste your Supabase connection string.",
    );
  }

  if (!globalForDb.__teacherWorkspaceDb) {
    globalForDb.__teacherWorkspaceSql = postgres(connectionString, {
      prepare: false,
      // 大屏會平行讀取多個領域資料。預設 3 條連線可避免單一連線把所有查詢序列化，
      // 在 serverless 部署時仍可透過 DATABASE_POOL_MAX 依 Supabase 額度下修。
      max: Number(process.env.DATABASE_POOL_MAX ?? 3),
      // 閒置連線盡快歸還給 Supabase session pool，避免短命程序累積占滿額度。
      idle_timeout: Number(process.env.DATABASE_IDLE_TIMEOUT_SECONDS ?? 20),
    });
    globalForDb.__teacherWorkspaceDb = drizzle(
      globalForDb.__teacherWorkspaceSql,
      {
        schema,
      },
    );
  }

  return globalForDb.__teacherWorkspaceDb;
}

/** Server-side DB. Lazy — safe to import without DATABASE_URL until first query. */
export const db = new Proxy({} as Database, {
  get(_target, prop, receiver) {
    const instance = createDb();
    const value = Reflect.get(instance, prop, receiver);
    return typeof value === "function" ? value.bind(instance) : value;
  },
});
