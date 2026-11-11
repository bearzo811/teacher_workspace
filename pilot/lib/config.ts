export const PILOT_SUPABASE_URL = "https://yqogdgvkeghyuibydqhw.supabase.co";
export const PILOT_SITE_URL = "https://teacher-workspace-pilot.vercel.app";
export const PILOT_COOKIE_NAME = "teacher-pilot-auth";

export function validatePilotConfig(env: Record<string, string | undefined>) {
  // Fail closed: a copied legacy configuration must never connect this app to it.
  if (env.PILOT_SUPABASE_URL !== PILOT_SUPABASE_URL) {
    throw new Error("新版 Supabase URL 未設定或不屬於獨立試用專案。");
  }
  const key = env.PILOT_SUPABASE_PUBLISHABLE_KEY;
  if (!key?.startsWith("sb_publishable_") || key.length < 30) {
    throw new Error("請設定新版專用的 publishable key；不可使用 secret 或 service-role key。");
  }
  return { url: PILOT_SUPABASE_URL, key };
}

export function pilotConfig() {
  return validatePilotConfig(process.env);
}

export function pilotCookieOptions() {
  return {
    name: PILOT_COOKIE_NAME,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
  };
}
