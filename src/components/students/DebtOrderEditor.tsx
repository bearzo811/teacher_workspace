"use client";
import { useCallback, useEffect, useState } from "react";
import type { DisplayDebtRow } from "@/types/display";

export function DebtOrderEditor({ studentId }: { studentId: string }) {
  const [items, setItems] = useState<DisplayDebtRow["priorityItems"]>([]);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [dirty, setDirty] = useState(false);
  const url = `/api/students/${studentId}/debt-order`;
  const load = useCallback(async () => {
    const response = await fetch(url);
    const json = await response.json();
    if (!response.ok) throw new Error(json.error ?? "讀取排序失敗");
    setItems(json.items); setDirty(false);
  }, [url]);
  useEffect(() => { setBusy(true); void load().catch((e) => setError(e.message)).finally(() => setBusy(false)); }, [load]);
  function move(index: number, target: number) {
    setItems((current) => { const result = [...current]; const [item] = result.splice(index, 1); result.splice(target, 0, item); return result; });
    setDirty(true); setMessage("");
  }
  async function save(reset = false) {
    setBusy(true); setError(""); setMessage("");
    try {
      const response = await fetch(url, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ keys: reset ? [] : items.map((item) => item.key) }) });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error);
      await load(); setMessage(reset ? "已恢復預設排序" : "已儲存，大屏將同步更新");
    } catch (e) { setError(e instanceof Error ? e.message : "儲存失敗"); }
    finally { setBusy(false); }
  }
  return <section className="rounded-xl border border-gray-200 bg-white p-5">
    <h2 className="text-lg font-semibold">欠繳優先順序</h2>
    <p className="mt-1 text-sm text-gray-500">只調整這位學生。第一項會在大屏放大顯示；完成或送出待確認後自動接續下一項。預設：最早作業 → 護照 → 讀報／閱讀心得。</p>
    {error && <p role="alert" className="mt-2 text-red-600">{error}</p>}
    {message && <p role="status" className="mt-2 text-green-700">{message}</p>}
    {!busy && !items.length && <p className="mt-3">目前沒有需要學生處理的欠繳項目。</p>}
    <ol className="mt-3 max-h-[32rem] space-y-2 overflow-y-auto">
      {items.map((item, index) => <li key={item.key} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3">
        <div><b>{index + 1}. {item.label}</b><p className="text-sm text-gray-500">{item.dueDate ? `繳交日 ${item.dueDate} · ` : ""}{item.status === "correction_required" ? "待訂正" : "未完成"}</p></div>
        <div className="flex gap-2">{[[0, "置頂"], [index - 1, "上移"], [index + 1, "下移"]].map(([target, label]) => <button key={label} type="button" className="rounded border px-3 py-2 text-sm disabled:opacity-30" disabled={busy || Number(target) < 0 || Number(target) >= items.length || Number(target) === index} aria-label={`${item.label} ${label}`} onClick={() => move(index, Number(target))}>{label}</button>)}</div>
      </li>)}
    </ol>
    <div className="mt-4 flex gap-3"><button type="button" disabled={busy || !dirty} onClick={() => void save()} className="rounded-lg bg-blue-600 px-4 py-2 text-white disabled:opacity-40">{busy ? "處理中…" : "儲存排序"}</button><button type="button" disabled={busy} onClick={() => void save(true)} className="rounded-lg border px-4 py-2 disabled:opacity-40">恢復預設排序</button></div>
  </section>;
}
