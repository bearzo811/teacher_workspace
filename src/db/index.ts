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
      max: 10,
    });
    globalForDb.__teacherWorkspaceDb = drizzle(globalForDb.__teacherWorkspaceSql, {
      schema,
    });
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
