import { NextResponse } from "next/server";
import { isDisplayKeyRequest, isTeacherRequest } from "@/lib/access";
import { getTermPassportView, setTermPassport } from "@/services/termPassportService";

function type(value: string | null | undefined) { return value === "Chinese" || value === "English" ? value : null; }
export async function GET(request: Request) {
  if (!(await isTeacherRequest())) return NextResponse.json({ error: "未授權" }, { status: 401 });
  const value = type(new URL(request.url).searchParams.get("type"));
  if (!value) return NextResponse.json({ error: "type 無效" }, { status: 400 });
  try { return NextResponse.json({ data: await getTermPassportView(value) }); } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "讀取失敗" }, { status: 400 }); }
}
export async function PATCH(request: Request) {
  const body = await request.json() as { studentId?: string; type?: string; completed?: boolean };
  const passportType = type(body.type);
  const teacher = await isTeacherRequest();
  const display = !teacher && await isDisplayKeyRequest(request);
  if ((!teacher && !display) || !body.studentId || !passportType || typeof body.completed !== "boolean") return NextResponse.json({ error: "資料或權限無效" }, { status: 400 });
  try { return NextResponse.json({ data: await setTermPassport({ studentId: body.studentId, type: passportType, completed: body.completed, actor: teacher ? "teacher" : "student" }) }); } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "更新失敗" }, { status: 400 }); }
}
