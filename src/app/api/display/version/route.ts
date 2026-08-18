import { NextResponse } from "next/server";
import { isDisplayKeyRequest, isTeacherRequest } from "@/lib/access";
import { getDisplayVersion } from "@/services/classSettingsService";

export const dynamic = "force-dynamic";

/** 僅讀取一列設定，供大屏判斷是否真的需要重新載入完整畫面資料。 */
export async function GET(request: Request) {
  if (!(await isTeacherRequest()) && !(await isDisplayKeyRequest(request))) {
    return NextResponse.json({ error: "未授權" }, { status: 401 });
  }
  return NextResponse.json({ data: { version: await getDisplayVersion() } });
}
