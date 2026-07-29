import { NextResponse } from "next/server";
import { getDashboardData } from "@/services/dashboardService";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const data = await getDashboardData();
    return NextResponse.json({ data });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "讀取 Dashboard 失敗";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
