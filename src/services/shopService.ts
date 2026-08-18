import { and, asc, desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { shopItems, shopOrders, studentGameProfiles, students } from "@/db/schema";
import { getClassSettings } from "@/services/classSettingsService";
import { setGamificationEffect } from "@/services/gamificationService";

export async function listShopItems(options?: { activeOnly?: boolean }) {
  const rows = await db.select().from(shopItems)
    .where(options?.activeOnly ? and(eq(shopItems.isActive, true), sql`${shopItems.stock} > 0`) : undefined)
    .orderBy(asc(shopItems.name));
  return rows;
}

export async function createShopItem(input: { name: string; icon?: string; price: number; stock: number }) {
  const name = input.name.trim();
  if (!name || !Number.isInteger(input.price) || input.price < 0 || !Number.isInteger(input.stock) || input.stock < 0) {
    throw new Error("商品名稱、所需點數與庫存格式不正確");
  }
  const [item] = await db.insert(shopItems).values({ name, icon: input.icon?.trim() || "🎁", price: input.price, stock: input.stock }).returning();
  return item;
}

export async function updateShopItem(input: { id: string; name?: string; icon?: string; price?: number; stock?: number; isActive?: boolean }) {
  const [existing] = await db.select().from(shopItems).where(eq(shopItems.id, input.id)).limit(1);
  if (!existing) throw new Error("找不到商品");
  if (input.price !== undefined && (!Number.isInteger(input.price) || input.price < 0)) throw new Error("所需點數不可為負數");
  if (input.stock !== undefined && (!Number.isInteger(input.stock) || input.stock < 0)) throw new Error("庫存不可為負數");
  const [item] = await db.update(shopItems).set({
    name: input.name?.trim() || undefined,
    icon: input.icon?.trim() || undefined,
    price: input.price,
    stock: input.stock,
    isActive: input.isActive,
    updatedAt: new Date(),
  }).where(eq(shopItems.id, input.id)).returning();
  return item;
}

export async function requestShopOrder(input: { studentId: string; itemId: string }) {
  const settings = await getClassSettings();
  if (!settings.shopOpen) throw new Error("目前不是商店時間");
  return db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`shop:${input.itemId}`}))`);
    const [item] = await tx.select().from(shopItems).where(eq(shopItems.id, input.itemId)).limit(1);
    if (!item || !item.isActive || item.stock < 1) throw new Error("商品已售完或下架");
    const [profile] = await tx.select().from(studentGameProfiles).where(eq(studentGameProfiles.studentId, input.studentId)).limit(1);
    const reserved = await tx.select({ total: sql<number>`coalesce(sum(${shopOrders.price}), 0)` }).from(shopOrders)
      .where(and(eq(shopOrders.studentId, input.studentId), eq(shopOrders.status, "pending")));
    if ((profile?.coinNet ?? 0) - Number(reserved[0]?.total ?? 0) < item.price) throw new Error("可用點數不足");
    await tx.update(shopItems).set({ stock: item.stock - 1, updatedAt: new Date() }).where(eq(shopItems.id, item.id));
    const [order] = await tx.insert(shopOrders).values({ itemId: item.id, studentId: input.studentId, price: item.price }).returning();
    return order;
  });
}

export async function listShopOrders() {
  return db.select({ order: shopOrders, itemName: shopItems.name, itemIcon: shopItems.icon, studentName: students.name, seatNumber: students.seatNumber })
    .from(shopOrders).innerJoin(shopItems, eq(shopOrders.itemId, shopItems.id)).innerJoin(students, eq(shopOrders.studentId, students.id))
    .orderBy(asc(shopOrders.status), desc(shopOrders.requestedAt));
}

export async function resolveShopOrder(input: { id: string; approve: boolean }) {
  const result = await db.transaction(async (tx) => {
    const [order] = await tx.select().from(shopOrders).where(eq(shopOrders.id, input.id)).limit(1);
    if (!order) throw new Error("找不到兌換申請");
    if (order.status !== "pending") throw new Error("此申請已處理");
    const status = input.approve ? "approved" : "rejected" as const;
    const [updated] = await tx.update(shopOrders).set({ status, resolvedAt: new Date(), resolvedBy: "teacher" }).where(eq(shopOrders.id, order.id)).returning();
    if (!input.approve) await tx.update(shopItems).set({ stock: sql`${shopItems.stock} + 1`, updatedAt: new Date() }).where(eq(shopItems.id, order.itemId));
    return updated;
  });
  if (input.approve) {
    await setGamificationEffect({ effectKey: `shop:${result.id}`, studentId: result.studentId, currency: "coins", sourceType: "shop", sourceId: result.id, effectType: "redeem", amount: -result.price, reason: "商店兌換", metadata: { itemId: result.itemId } });
  }
  return result;
}
