import { and, asc, desc, eq, inArray, or, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  shopItems,
  studentGameProfiles,
  studentRewardHistory,
  studentRewards,
  students,
  type StudentReward,
} from "@/db/schema";
import { getClassSettings } from "@/services/classSettingsService";
import { setGamificationEffect } from "@/services/gamificationService";

export type RewardKind = "physical" | "privilege";
export type RewardStatus = "available" | "requested" | "redeemed" | "revoked";

export type BackpackReward = Pick<
  StudentReward,
  "id" | "studentId" | "itemId" | "itemName" | "itemIcon" | "kind" | "description" | "pricePaid" | "source" | "status" | "requestedAt" | "redeemedAt" | "createdAt"
>;

export async function listShopItems(options?: { activeOnly?: boolean }) {
  const where = options?.activeOnly
    ? and(
        eq(shopItems.isActive, true),
        or(eq(shopItems.stock, -1), sql`${shopItems.stock} > 0`),
      )
    : undefined;
  return db.select().from(shopItems).where(where).orderBy(asc(shopItems.name));
}

export async function createShopItem(input: {
  name: string;
  icon?: string;
  price: number;
  stock: number;
  kind?: RewardKind;
  description?: string;
}) {
  const name = input.name.trim();
  if (!name || !Number.isInteger(input.price) || input.price < 0 || !Number.isInteger(input.stock) || input.stock < -1) {
    throw new Error("商品名稱、所需點數與庫存格式不正確");
  }
  const [item] = await db.insert(shopItems).values({
    name,
    icon: input.icon?.trim() || "🎁",
    price: input.price,
    stock: input.stock,
    kind: input.kind ?? "physical",
    description: input.description?.trim() ?? "",
  }).returning();
  return item;
}

export async function updateShopItem(input: {
  id: string;
  name?: string;
  icon?: string;
  price?: number;
  stock?: number;
  kind?: RewardKind;
  description?: string;
  isActive?: boolean;
}) {
  const [existing] = await db.select().from(shopItems).where(eq(shopItems.id, input.id)).limit(1);
  if (!existing) throw new Error("找不到商品");
  if (input.price !== undefined && (!Number.isInteger(input.price) || input.price < 0)) throw new Error("所需點數不可為負數");
  if (input.stock !== undefined && (!Number.isInteger(input.stock) || input.stock < -1)) throw new Error("庫存須為 -1（無限）或非負整數");
  const [item] = await db.update(shopItems).set({
    name: input.name?.trim() || undefined,
    icon: input.icon?.trim() || undefined,
    price: input.price,
    stock: input.stock,
    kind: input.kind,
    description: input.description?.trim(),
    isActive: input.isActive,
    updatedAt: new Date(),
  }).where(eq(shopItems.id, input.id)).returning();
  return item;
}

async function addHistory(rewardId: string, action: string, actor: "student" | "teacher", note = "") {
  await db.insert(studentRewardHistory).values({ rewardId, action, actor, note });
}

/** 學生購買：立即扣金幣、有限庫存立即保留，並放入背包。 */
export async function purchaseShopItem(input: { studentId: string; itemId: string }) {
  const settings = await getClassSettings();
  if (!settings.shopOpen) throw new Error("目前不是商店時間");
  const reward = await db.transaction(async (tx) => {
    // 依商品上鎖，避免不同學生同時搶最後一份庫存時超賣。
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`shop:${input.itemId}`}))`);
    const [item] = await tx.select().from(shopItems).where(eq(shopItems.id, input.itemId)).limit(1);
    if (!item || !item.isActive || item.stock === 0) throw new Error("商品已售完或下架");
    const [student] = await tx.select({ id: students.id }).from(students)
      .where(and(eq(students.id, input.studentId), eq(students.isActive, true))).limit(1);
    if (!student) throw new Error("找不到學生");
    const [profile] = await tx.select().from(studentGameProfiles)
      .where(eq(studentGameProfiles.studentId, input.studentId)).limit(1);
    if ((profile?.coinNet ?? 0) < item.price) throw new Error("金幣不足");
    if (item.stock >= 0) {
      await tx.update(shopItems).set({ stock: item.stock - 1, updatedAt: new Date() })
        .where(eq(shopItems.id, item.id));
    }
    const [created] = await tx.insert(studentRewards).values({
      studentId: input.studentId,
      itemId: item.id,
      itemName: item.name,
      itemIcon: item.icon,
      kind: item.kind,
      description: item.description,
      pricePaid: item.price,
      source: "purchase",
    }).returning();
    return created;
  });
  await setGamificationEffect({
    effectKey: `reward-purchase:${reward.id}`,
    studentId: input.studentId,
    currency: "coins",
    sourceType: "reward",
    sourceId: reward.id,
    effectType: "purchase",
    amount: -reward.pricePaid,
    reason: `兌換：${reward.itemName}`,
  });
  await addHistory(reward.id, "purchased", "student");
  return reward;
}

/** 老師贈送不扣學生金幣，也不影響商品庫存。 */
export async function grantReward(input: { studentId: string; itemId: string }) {
  const [item] = await db.select().from(shopItems).where(eq(shopItems.id, input.itemId)).limit(1);
  if (!item) throw new Error("找不到商品");
  const [student] = await db.select({ id: students.id }).from(students)
    .where(and(eq(students.id, input.studentId), eq(students.isActive, true))).limit(1);
  if (!student) throw new Error("找不到學生，請重新選擇");
  const [reward] = await db.insert(studentRewards).values({
    studentId: input.studentId, itemId: item.id, itemName: item.name, itemIcon: item.icon,
    kind: item.kind, description: item.description, pricePaid: 0, source: "gift",
  }).returning();
  await addHistory(reward.id, "granted", "teacher");
  return reward;
}

export async function requestRewardUse(rewardId: string) {
  const [reward] = await db.select().from(studentRewards).where(eq(studentRewards.id, rewardId)).limit(1);
  if (!reward || reward.status !== "available") throw new Error("此獎品目前不能提出使用");
  const [updated] = await db.update(studentRewards).set({ status: "requested", requestedAt: new Date(), updatedAt: new Date() })
    .where(eq(studentRewards.id, rewardId)).returning();
  await addHistory(rewardId, "requested", "student");
  return updated;
}

export async function cancelRewardRequest(rewardId: string) {
  const [reward] = await db.select().from(studentRewards).where(eq(studentRewards.id, rewardId)).limit(1);
  if (!reward || reward.status !== "requested") throw new Error("此申請目前不能取消");
  const [updated] = await db.update(studentRewards).set({ status: "available", requestedAt: null, updatedAt: new Date() })
    .where(eq(studentRewards.id, rewardId)).returning();
  await addHistory(rewardId, "request_cancelled", "student");
  return updated;
}

export async function resolveRewardRequest(input: { rewardId: string; complete: boolean }) {
  const [reward] = await db.select().from(studentRewards).where(eq(studentRewards.id, input.rewardId)).limit(1);
  if (!reward || reward.status !== "requested") throw new Error("此申請目前不能處理");
  const [updated] = await db.update(studentRewards).set({
    status: input.complete ? "redeemed" : "available",
    requestedAt: input.complete ? reward.requestedAt : null,
    redeemedAt: input.complete ? new Date() : null,
    updatedAt: new Date(),
  }).where(eq(studentRewards.id, input.rewardId)).returning();
  await addHistory(input.rewardId, input.complete ? "redeemed" : "returned", "teacher");
  return updated;
}

export async function revokeReward(input: { rewardId: string; refund: boolean }) {
  const [reward] = await db.select().from(studentRewards).where(eq(studentRewards.id, input.rewardId)).limit(1);
  if (!reward || reward.status === "redeemed" || reward.status === "revoked") throw new Error("此獎品目前不能刪除");
  const [updated] = await db.update(studentRewards).set({ status: "revoked", revokedAt: new Date(), updatedAt: new Date() })
    .where(eq(studentRewards.id, input.rewardId)).returning();
  if (input.refund && reward.source === "purchase") {
    await setGamificationEffect({
      effectKey: `reward-purchase:${reward.id}`, studentId: reward.studentId, currency: "coins",
      sourceType: "reward", sourceId: reward.id, effectType: "purchase", amount: 0,
      reason: `撤銷退款：${reward.itemName}`,
    });
  }
  await addHistory(reward.id, input.refund ? "revoked_refunded" : "revoked", "teacher");
  return updated;
}

export async function listStudentRewards(studentIds?: string[]) {
  const where = studentIds?.length ? inArray(studentRewards.studentId, studentIds) : undefined;
  return db.select({ reward: studentRewards, name: students.name, seatNumber: students.seatNumber })
    .from(studentRewards).innerJoin(students, eq(studentRewards.studentId, students.id))
    .where(where).orderBy(asc(students.seatNumber), desc(studentRewards.createdAt));
}

export async function listPendingRewardRequests() {
  return listStudentRewards().then((rows) => rows.filter((row) => row.reward.status === "requested"));
}
