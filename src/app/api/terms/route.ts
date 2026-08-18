import { NextResponse } from "next/server";
import {
  activateTerm,
  createTerm,
  getActiveTerm,
  listTerms,
} from "@/services/termService";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const [data, activeTerm] = await Promise.all([listTerms(), getActiveTerm()]);
    return NextResponse.json({ data, activeTerm });
  } catch (error) {
    const message = error instanceof Error ? error.message : "讀取學期失敗";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      name?: string;
      schoolYear?: string;
      startsOn?: string;
      endsOn?: string;
      activate?: boolean;
    };
    if (
      typeof body.name !== "string" ||
      typeof body.schoolYear !== "string" ||
      typeof body.startsOn !== "string" ||
      typeof body.endsOn !== "string"
    ) {
      return NextResponse.json(
        { error: "請提供學期名稱、學年度、開始日與結束日" },
        { status: 400 },
      );
    }
    const data = await createTerm({
      name: body.name,
      schoolYear: body.schoolYear,
      startsOn: body.startsOn,
      endsOn: body.endsOn,
      activate: body.activate === true,
    });
    return NextResponse.json({ data }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "建立學期失敗";
    const status = message.includes("填寫") || message.includes("日期") ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function PATCH(request: Request) {
  try {
    const body = (await request.json()) as { id?: string; action?: "activate" };
    if (!body.id || body.action !== "activate") {
      return NextResponse.json({ error: "請提供 id 與 action=activate" }, { status: 400 });
    }
    const data = await activateTerm(body.id);
    return NextResponse.json({ data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "啟用學期失敗";
    return NextResponse.json({ error: message }, { status: message.includes("找不到") ? 404 : 500 });
  }
}
