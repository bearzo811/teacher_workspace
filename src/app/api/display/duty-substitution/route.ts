import { NextResponse } from "next/server";
import { isDisplayKeyRequest, isTeacherRequest } from "@/lib/access";
import { claimDutySubstitution } from "@/services/dutyService";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { id?: string; studentId?: string };
    if (!body.id || !body.studentId) {
      return NextResponse.json({ error: "請選擇要代班的工作與座號" }, { status: 400 });
    }
    if (!(await isTeacherRequest()) && !(await isDisplayKeyRequest(request))) {
      return NextResponse.json({ error: "未授權" }, { status: 401 });
    }
    return NextResponse.json({ data: await claimDutySubstitution({ id: body.id, studentId: body.studentId }) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "登記代班失敗" }, { status: 400 });
  }
}
