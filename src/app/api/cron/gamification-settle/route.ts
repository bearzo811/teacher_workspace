import { NextResponse } from "next/server";
import { apiErrorMessage } from "@/lib/apiError";
import { settleGamificationOverdue } from "@/services/gamificationService";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const data = await settleGamificationOverdue();
    return NextResponse.json({ data });
  } catch (error) {
    return NextResponse.json(
      { error: apiErrorMessage(error, "養成系統逾期結算失敗") },
      { status: 500 },
    );
  }
}
