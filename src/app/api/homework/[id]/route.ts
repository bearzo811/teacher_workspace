import { NextResponse } from "next/server";
import { deleteHomeworkItem } from "@/services/homeworkService";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    await deleteHomeworkItem(id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "刪除作業失敗";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
