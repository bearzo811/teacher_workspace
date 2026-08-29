import { cookies } from "next/headers";
import {
  DISPLAY_SESSION_COOKIE,
  TEACHER_SESSION_COOKIE,
  hasDisplaySession,
  hasTeacherSession,
} from "@/lib/auth";

export async function isTeacherRequest() {
  const store = await cookies();
  return hasTeacherSession(store.get(TEACHER_SESSION_COOKIE)?.value);
}

export async function isDisplayRequest() {
  const store = await cookies();
  return hasDisplaySession(store.get(DISPLAY_SESSION_COOKIE)?.value);
}

/**
 * 暫時開放教室大屏：學生可直接開啟並自助操作，不需要網址金鑰或登入。
 * 導師工作台的教師 Session 仍由 middleware 保護。
 */
export async function isDisplayKeyRequest(_request: Request) {
  void _request;
  return true;
}

export async function requireTeacher() {
  if (!(await isTeacherRequest())) throw new Error("未授權");
}

export async function requireDisplay() {
  if (!(await isDisplayRequest())) throw new Error("大屏未授權");
}
