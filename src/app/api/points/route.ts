import { NextResponse } from "next/server";
import { addManualCoins } from "@/services/gamificationService";

export async function POST(request: Request) {
  try {
    const body = await request.json() as { studentId?: string; amount?: number; reason?: string };
    if (!body.studentId || typeof body.amount !== "number" || typeof body.reason !== "string") {
      return NextResponse.json({ error: "請提供 studentId、amount、reason" }, { status: 400 });
    }
    return NextResponse.json({ data: await addManualCoins({ studentId: body.studentId, amount: body.amount, reason: body.reason }) }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "調整點數失敗" }, { status: 400 });
  }
}
