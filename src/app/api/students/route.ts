import { NextResponse } from "next/server";
import { createStudent, listStudents } from "@/services/studentService";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const q = searchParams.get("q") ?? undefined;
    const data = await listStudents(q);
    return NextResponse.json({ data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "讀取學生失敗";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      name?: string;
      seatNumber?: number;
    };

    if (typeof body.name !== "string" || typeof body.seatNumber !== "number") {
      return NextResponse.json(
        { error: "請提供 name（字串）與 seatNumber（數字）" },
        { status: 400 },
      );
    }

    const data = await createStudent({
      name: body.name,
      seatNumber: body.seatNumber,
    });
    return NextResponse.json({ data }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "新增學生失敗";
    const status = message.includes("座號") || message.includes("姓名") ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
