import { NextResponse } from "next/server";
import { cancelRewardRequest, createShopItem, grantReward, listPendingRewardRequests, listShopItems, listStudentRewards, purchaseShopItem, requestRewardUse, resolveRewardRequest, revokeReward, updateShopItem } from "@/services/shopService";
import { isDisplayKeyRequest, isTeacherRequest } from "@/lib/access";
import { touchDisplayVersion } from "@/services/classSettingsService";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await isTeacherRequest())) return NextResponse.json({ error: "未授權" }, { status: 401 });
  const [items, pendingRequests, rewards] = await Promise.all([listShopItems(), listPendingRewardRequests(), listStudentRewards()]);
  return NextResponse.json({ data: { items, pendingRequests, rewards } });
}
export async function POST(request: Request) {
  try {
    const body = await request.json() as { action?: string; name?: string; icon?: string; price?: number; stock?: number; kind?: "physical" | "privilege"; description?: string; studentId?: string; itemId?: string; rewardId?: string };
    if (body.action === "purchase" || body.action === "request") {
      // 與作業、每日任務一致：教師工作台或持有大屏存取碼的教室大屏都可代學生送出申請。
      const teacher = await isTeacherRequest();
      const display = !teacher && (await isDisplayKeyRequest(request));
      if ((!teacher && !display) || !body.studentId || !body.itemId) return NextResponse.json({ error: "未授權" }, { status: 401 });
      const data = await purchaseShopItem({ studentId: body.studentId, itemId: body.itemId });
      await touchDisplayVersion();
      return NextResponse.json({ data }, { status: 201 });
    }
    if (body.action === "request-use" || body.action === "cancel-use") {
      const teacher = await isTeacherRequest();
      const display = !teacher && (await isDisplayKeyRequest(request));
      if ((!teacher && !display) || !body.rewardId) return NextResponse.json({ error: "未授權" }, { status: 401 });
      const data = body.action === "request-use" ? await requestRewardUse(body.rewardId) : await cancelRewardRequest(body.rewardId);
      await touchDisplayVersion();
      return NextResponse.json({ data });
    }
    if (!(await isTeacherRequest())) return NextResponse.json({ error: "未授權" }, { status: 401 });
    const data = body.action === "grant"
      ? (!body.studentId || !body.itemId ? null : await grantReward({ studentId: body.studentId, itemId: body.itemId }))
      : await createShopItem({ name: body.name ?? "", icon: body.icon, price: body.price ?? -1, stock: body.stock ?? -1, kind: body.kind, description: body.description });
    if (!data) return NextResponse.json({ error: "請選擇學生與商品" }, { status: 400 });
    await touchDisplayVersion();
    return NextResponse.json({ data }, { status: 201 });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "商店操作失敗" }, { status: 400 }); }
}
export async function PATCH(request: Request) {
  try {
    if (!(await isTeacherRequest())) return NextResponse.json({ error: "未授權" }, { status: 401 });
    const body = await request.json() as { action?: string; id?: string; name?: string; icon?: string; price?: number; stock?: number; kind?: "physical" | "privilege"; description?: string; isActive?: boolean; refund?: boolean };
    if (!body.id) return NextResponse.json({ error: "請提供 id" }, { status: 400 });
    const data = body.action === "redeem"
      ? await resolveRewardRequest({ rewardId: body.id, complete: true })
      : body.action === "return"
        ? await resolveRewardRequest({ rewardId: body.id, complete: false })
        : body.action === "revoke"
          ? await revokeReward({ rewardId: body.id, refund: body.refund === true })
          : await updateShopItem({ id: body.id, name: body.name, icon: body.icon, price: body.price, stock: body.stock, kind: body.kind, description: body.description, isActive: body.isActive });
    await touchDisplayVersion();
    return NextResponse.json({ data });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "商店操作失敗" }, { status: 400 }); }
}
