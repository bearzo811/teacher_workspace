import { cookies } from "next/headers";
import {
  DISPLAY_SESSION_COOKIE,
  TEACHER_SESSION_COOKIE,
  hasDisplaySession,
  hasTeacherSession,
} from "@/lib/auth";
import { verifyDisplayAccessCode } from "@/services/classSettingsService";

export async function isTeacherRequest() {
  const store = await cookies();
  return hasTeacherSession(store.get(TEACHER_SESSION_COOKIE)?.value);
}

export async function isDisplayRequest() {
  const store = await cookies();
  return hasDisplaySession(store.get(DISPLAY_SESSION_COOKIE)?.value);
}

/** 大屏使用其專屬網址附帶的長隨機鍵；不可視為教師權限。 */
export async function isDisplayKeyRequest(request: Request) {
  const headerKey = request.headers.get("x-display-key");
  const urlKey = new URL(request.url).searchParams.get("key");
  const key = headerKey ?? urlKey;
  return Boolean(key && (await verifyDisplayAccessCode(key)));
}

export async function requireTeacher() {
  if (!(await isTeacherRequest())) throw new Error("未授權");
}

export async function requireDisplay() {
  if (!(await isDisplayRequest())) throw new Error("大屏未授權");
}
