"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";

type Item = { id: string; name: string; icon: string; price: number; stock: number; isActive: boolean };
type Order = { order: { id: string; status: string; price: number; requestedAt: string }; itemName: string; itemIcon: string; studentName: string; seatNumber: number };

export function ShopPageClient() {
  const [items, setItems] = useState<Item[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [name, setName] = useState("");
  const [price, setPrice] = useState("0");
  const [stock, setStock] = useState("0");
  const [icon, setIcon] = useState("🎁");
  const [error, setError] = useState<string | null>(null);
  const [shopOpen, setShopOpen] = useState(false);
  const load = useCallback(async () => {
    const [response, settingsResponse] = await Promise.all([fetch("/api/shop"), fetch("/api/settings")]);
    const json = await response.json() as { data?: { items: Item[]; orders: Order[] }; error?: string };
    if (!response.ok) throw new Error(json.error ?? "讀取商店失敗");
    setItems(json.data?.items ?? []); setOrders(json.data?.orders ?? []);
    const settings = await settingsResponse.json() as { data?: { shopOpen?: boolean } };
    if (settingsResponse.ok) setShopOpen(settings.data?.shopOpen === true);
  }, []);
  useEffect(() => { void load().catch((err) => setError(err.message)); }, [load]);
  async function create() {
    setError(null);
    try {
      const response = await fetch("/api/shop", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, icon, price: Number(price), stock: Number(stock) }) });
      const json = await response.json() as { error?: string };
      if (!response.ok) throw new Error(json.error ?? "新增失敗");
      setName(""); setPrice("0"); setStock("0"); await load();
    } catch (err) { setError(err instanceof Error ? err.message : "新增失敗"); }
  }
  async function resolve(id: string, approve: boolean) {
    setError(null);
    try {
      const response = await fetch("/api/shop", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "resolve", id, approve }) });
      const json = await response.json() as { error?: string };
      if (!response.ok) throw new Error(json.error ?? "處理失敗");
      await load();
    } catch (err) { setError(err instanceof Error ? err.message : "處理失敗"); }
  }
  async function toggleShopOpen() {
    try {
      const next = !shopOpen;
      const response = await fetch("/api/settings", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ shopOpen: next }) });
      const json = await response.json() as { error?: string };
      if (!response.ok) throw new Error(json.error ?? "更新商店時間失敗");
      setShopOpen(next);
    } catch (err) { setError(err instanceof Error ? err.message : "更新商店時間失敗"); }
  }
  return <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
    <header className="flex flex-wrap items-end justify-between gap-3"><div><h1 className="text-2xl font-semibold">商店</h1><p className="mt-1 text-sm text-gray-500">學生申請後先保留庫存與點數；核准才正式扣點。</p></div><Button variant={shopOpen ? "primary" : "secondary"} onClick={() => void toggleShopOpen()}>{shopOpen ? "商店時間：開放中（點此關閉）" : "開啟商店時間"}</Button></header>
    {error ? <p className="text-sm text-red-600">{error}</p> : null}
    <Card><CardTitle>新增商品</CardTitle><div className="mt-4 grid gap-2 sm:grid-cols-4"><input value={icon} onChange={(e) => setIcon(e.target.value)} className="h-10 rounded border px-3" aria-label="商品圖示"/><input value={name} onChange={(e) => setName(e.target.value)} placeholder="商品名稱" className="h-10 rounded border px-3"/><input value={price} onChange={(e) => setPrice(e.target.value)} type="number" min="0" className="h-10 rounded border px-3" placeholder="點數"/><input value={stock} onChange={(e) => setStock(e.target.value)} type="number" min="0" className="h-10 rounded border px-3" placeholder="庫存"/></div><Button className="mt-3" disabled={!name.trim()} onClick={() => void create()}>新增商品</Button></Card>
    <Card><CardTitle>商品清單</CardTitle><div className="mt-3 grid gap-2 sm:grid-cols-2">{items.map((item) => <div key={item.id} className="rounded-lg border p-3"><b>{item.icon} {item.name}</b><p className="text-sm text-gray-500">{item.price} 點・庫存 {item.stock} {item.isActive ? "" : "・已下架"}</p></div>)}</div></Card>
    <Card><CardTitle>待處理申請</CardTitle><CardDescription>核准後扣點；拒絕後釋放保留庫存與點數。</CardDescription><div className="mt-3 space-y-2">{orders.filter(({ order }) => order.status === "pending").map(({ order, itemName, itemIcon, studentName, seatNumber }) => <div key={order.id} className="flex flex-wrap items-center gap-2 rounded-lg border p-3"><span className="flex-1">{seatNumber} 號 {studentName}：{itemIcon} {itemName}（{order.price} 點）</span><Button size="sm" onClick={() => void resolve(order.id, true)}>核准</Button><Button size="sm" variant="secondary" onClick={() => void resolve(order.id, false)}>拒絕</Button></div>)}{orders.every(({order}) => order.status !== "pending") ? <p className="text-sm text-gray-400">目前沒有待處理申請</p> : null}</div></Card>
  </div>;
}
