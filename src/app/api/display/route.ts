import { NextResponse } from "next/server";
import { isDisplayKeyRequest, isTeacherRequest } from "@/lib/access";
import { getDisplayData } from "@/services/displayService";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    if (!(await isTeacherRequest()) && !(await isDisplayKeyRequest(request))) {
      return NextResponse.json({ error: "未授權" }, { status: 401 });
    }
    const contactBookDate = searchParams.get("contactBookDate") ?? undefined;
    if (
      contactBookDate &&
      contactBookDate !== "" &&
      !/^\d{4}-\d{2}-\d{2}$/.test(contactBookDate)
    ) {
      return NextResponse.json(
        { error: "聯絡簿日期格式須為 YYYY-MM-DD" },
        { status: 400 },
      );
    }
    const data = await getDisplayData(
      contactBookDate ? { contactBookDate } : undefined,
    );
    return NextResponse.json({ data });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "讀取教室大屏失敗";
    const status = message.includes("未授權") ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
