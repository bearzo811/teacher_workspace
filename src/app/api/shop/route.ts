import { NextResponse } from "next/server";
import { createShopItem, listShopItems, listShopOrders, requestShopOrder, resolveShopOrder, updateShopItem } from "@/services/shopService";
import { isDisplayKeyRequest, isTeacherRequest } from "@/lib/access";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await isTeacherRequest())) return NextResponse.json({ error: "未授權" }, { status: 401 });
  return NextResponse.json({ data: { items: await listShopItems(), orders: await listShopOrders() } });
}
export async function POST(request: Request) {
  try {
    const body = await request.json() as { action?: string; name?: string; icon?: string; price?: number; stock?: number; studentId?: string; itemId?: string };
    if (body.action === "request") {
      if (!(await isDisplayKeyRequest(request)) || !body.studentId || !body.itemId) return NextResponse.json({ error: "未授權" }, { status: 401 });
      return NextResponse.json({ data: await requestShopOrder({ studentId: body.studentId, itemId: body.itemId }) }, { status: 201 });
    }
    if (!(await isTeacherRequest())) return NextResponse.json({ error: "未授權" }, { status: 401 });
    return NextResponse.json({ data: await createShopItem({ name: body.name ?? "", icon: body.icon, price: body.price ?? -1, stock: body.stock ?? -1 }) }, { status: 201 });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "商店操作失敗" }, { status: 400 }); }
}
export async function PATCH(request: Request) {
  try {
    if (!(await isTeacherRequest())) return NextResponse.json({ error: "未授權" }, { status: 401 });
    const body = await request.json() as { action?: string; id?: string; approve?: boolean; name?: string; icon?: string; price?: number; stock?: number; isActive?: boolean };
    if (!body.id) return NextResponse.json({ error: "請提供 id" }, { status: 400 });
    const data = body.action === "resolve"
      ? await resolveShopOrder({ id: body.id, approve: body.approve === true })
      : await updateShopItem({ id: body.id, name: body.name, icon: body.icon, price: body.price, stock: body.stock, isActive: body.isActive });
    return NextResponse.json({ data });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "商店操作失敗" }, { status: 400 }); }
}
