import { NextResponse } from "next/server";
import { createHomeworkSubject, listHomeworkSubjects, updateHomeworkSubject } from "@/services/homeworkSubjectService";

export async function GET(request: Request) {
  const activeOnly = new URL(request.url).searchParams.get("activeOnly") !== "0";
  return NextResponse.json({ data: await listHomeworkSubjects(activeOnly) });
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { name?: string; sortOrder?: number };
    if (typeof body.name !== "string") return NextResponse.json({ error: "請提供科目名稱" }, { status: 400 });
    return NextResponse.json(
      { data: await createHomeworkSubject({ name: body.name, sortOrder: body.sortOrder }) },
      { status: 201 },
    );
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "新增科目失敗" }, { status: 400 });
  }
}

export async function PATCH(request: Request) {
  try {
    const body = (await request.json()) as { id?: string; name?: string; sortOrder?: number; isActive?: boolean };
    if (!body.id) return NextResponse.json({ error: "請提供 id" }, { status: 400 });
    return NextResponse.json({ data: await updateHomeworkSubject({ id: body.id, name: body.name, sortOrder: body.sortOrder, isActive: body.isActive }) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "更新科目失敗" }, { status: 400 });
  }
}
