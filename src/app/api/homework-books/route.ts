import { NextResponse } from "next/server";
import {
  createHomeworkBook,
  listHomeworkBooks,
  updateHomeworkBook,
} from "@/services/homeworkBookService";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const activeOnly = searchParams.get("activeOnly") !== "0";
    const data = await listHomeworkBooks({ activeOnly });
    return NextResponse.json({ data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "讀取簿本失敗";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      name?: string;
      subjectId?: string | null;
      sortOrder?: number;
    };
    if (typeof body.name !== "string") {
      return NextResponse.json({ error: "請提供 name" }, { status: 400 });
    }
    const data = await createHomeworkBook({
      name: body.name,
      subjectId: body.subjectId,
      sortOrder: body.sortOrder,
    });
    return NextResponse.json({ data }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "新增簿本失敗";
    const status =
      message.includes("請") || message.includes("已存在") ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function PATCH(request: Request) {
  try {
    const body = (await request.json()) as {
      id?: string;
      name?: string;
      subjectId?: string | null;
      sortOrder?: number;
      isActive?: boolean;
    };
    if (!body.id) {
      return NextResponse.json({ error: "請提供 id" }, { status: 400 });
    }
    const data = await updateHomeworkBook({
      id: body.id,
      name: body.name,
      subjectId: body.subjectId,
      sortOrder: body.sortOrder,
      isActive: body.isActive,
    });
    return NextResponse.json({ data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "更新簿本失敗";
    const status =
      message.includes("請") ||
      message.includes("已存在") ||
      message.includes("找不到")
        ? 400
        : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
