import { NextResponse } from "next/server";
import { isTeacherRequest } from "@/lib/access";
import { getSemesterReadiness } from "@/services/readinessService";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await isTeacherRequest())) {
    return NextResponse.json({ error: "未授權" }, { status: 401 });
  }
  try {
    return NextResponse.json({ data: await getSemesterReadiness() });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "開學檢查失敗" },
      { status: 500 },
    );
  }
}
