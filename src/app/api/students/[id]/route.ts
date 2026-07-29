import { NextResponse } from "next/server";
import {
  getStudentById,
  softDeleteStudent,
  updateStudent,
} from "@/services/studentService";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const data = await getStudentById(id);
    if (!data || !data.isActive) {
      return NextResponse.json({ error: "找不到學生" }, { status: 404 });
    }
    return NextResponse.json({ data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "讀取學生失敗";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const body = (await request.json()) as {
      name?: string;
      seatNumber?: number;
    };

    const data = await updateStudent(id, {
      name: body.name,
      seatNumber: body.seatNumber,
    });
    return NextResponse.json({ data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "更新學生失敗";
    const status =
      message.includes("找不到")
        ? 404
        : message.includes("座號") || message.includes("姓名")
          ? 400
          : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const data = await softDeleteStudent(id);
    return NextResponse.json({ data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "刪除學生失敗";
    const status = message.includes("找不到") ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
