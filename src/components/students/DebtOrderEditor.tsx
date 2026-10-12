"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { DisplayDebtRow } from "@/types/display";

export function DebtOrderEditor({ studentId }: { studentId: string }) {
  const [items, setItems] = useState<DisplayDebtRow["priorityItems"]>([]);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [dirty, setDirty] = useState(false);
  const [showOtherItems, setShowOtherItems] = useState(true);
  const [dragKey, setDragKey] = useState<string | null>(null);
  const listRef = useRef<HTMLOListElement>(null);
  const beforeDrag = useRef<DisplayDebtRow["priorityItems"]>([]);
  const url = `/api/students/${studentId}/debt-order`;
  const load = useCallback(async () => {
    const response = await fetch(url);
    const json = await response.json();
    if (!response.ok) throw new Error(json.error ?? "讀取排序失敗");
    setItems(json.items); setShowOtherItems(json.showOtherItems ?? true); setDirty(false);
  }, [url]);
  useEffect(() => { setBusy(true); void load().catch((e) => setError(e.message)).finally(() => setBusy(false)); }, [load]);
  function move(index: number, target: number) {
    setItems((current) => { const result = [...current]; const [item] = result.splice(index, 1); result.splice(target, 0, item); return result; });
    setDirty(true); setMessage("");
  }
  async function save(reset = false) {
    setBusy(true); setError(""); setMessage("");
    try {
      const response = await fetch(url, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ keys: reset ? [] : items.map((item) => item.key), showOtherItems }) });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error);
      await load(); setMessage(reset ? "已恢復預設排序" : "已儲存，大屏將同步更新");
    } catch (e) { setError(e instanceof Error ? e.message : "儲存失敗"); }
    finally { setBusy(false); }
  }
  return <section className="rounded-xl border border-gray-200 bg-white p-5">
    <h2 className="text-lg font-semibold">欠繳優先順序</h2>
    <label className="my-3 flex items-center gap-2">
      <input type="checkbox" checked={showOtherItems} disabled={busy} onChange={(event) => { setShowOtherItems(event.target.checked); setDirty(true); setMessage(""); }} />
      顯示其他欠繳項目
    </label>
    <p className="text-sm text-gray-500">關閉後，大屏只保留「下一個先完成」，隱藏下方其他項目與待確認清單；不影響下課或商店限制。儲存後生效。</p>
    <p className="mt-1 text-sm text-gray-500">拖曳左側把手調整這位學生的順序，完成後按儲存。第一項會在大屏放大顯示。預設：最新作業 → 護照 → 閱讀／讀報。也可聚焦把手後用方向鍵調整。</p>
    {error && <p role="alert" className="mt-2 text-red-600">{error}</p>}
    {message && <p role="status" className="mt-2 text-green-700">{message}</p>}
    {!busy && !items.length && <p className="mt-3">目前沒有需要學生處理的欠繳項目。</p>}
    <ol ref={listRef} className="mt-3 max-h-[32rem] space-y-2 overflow-y-auto">
      {items.map((item, index) => <li key={item.key} data-debt-key={item.key} className={`flex items-center gap-3 rounded-lg border p-3 ${dragKey === item.key ? "border-blue-500 bg-blue-50 ring-2 ring-blue-200" : ""}`}>
        <button type="button" disabled={busy} aria-label={`拖曳排序：${item.label}`} className="shrink-0 touch-none select-none rounded border px-3 py-3 text-xl cursor-grab active:cursor-grabbing disabled:opacity-30"
          onPointerDown={(event) => {
            if (event.button !== 0) return;
            beforeDrag.current = [...items];
            setDragKey(item.key);
            event.currentTarget.setPointerCapture(event.pointerId);
          }}
          onPointerMove={(event) => {
            if (dragKey !== item.key || !listRef.current) return;
            const list = listRef.current;
            const bounds = list.getBoundingClientRect();
            if (event.clientY < bounds.top + 50) list.scrollTop -= 20;
            if (event.clientY > bounds.bottom - 50) list.scrollTop += 20;
            const target = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>("[data-debt-key]");
            if (!target || !list.contains(target)) return;
            const from = items.findIndex((entry) => entry.key === item.key);
            const to = items.findIndex((entry) => entry.key === target.dataset.debtKey);
            if (from >= 0 && to >= 0 && from !== to) move(from, to);
          }}
          onPointerUp={() => setDragKey(null)}
          onPointerCancel={() => { setItems(beforeDrag.current); setDragKey(null); }}
          onLostPointerCapture={() => setDragKey(null)}
          onKeyDown={(event) => {
            const target = event.key === "ArrowUp" ? index - 1 : event.key === "ArrowDown" ? index + 1 : -1;
            if (target >= 0 && target < items.length) { event.preventDefault(); move(index, target); }
          }}
        >⠿</button>
        <div><b>{index + 1}. {item.label}</b><p className="text-sm text-gray-500">{item.dueDate ? `繳交日 ${item.dueDate} · ` : ""}{item.status === "correction_required" ? "待訂正" : "未完成"}</p></div>
      </li>)}
    </ol>
    <div className="mt-4 flex gap-3"><button type="button" disabled={busy || !dirty} onClick={() => void save()} className="rounded-lg bg-blue-600 px-4 py-2 text-white disabled:opacity-40">{busy ? "處理中…" : "儲存排序"}</button><button type="button" disabled={busy} onClick={() => void save(true)} className="rounded-lg border px-4 py-2 disabled:opacity-40">恢復預設排序</button></div>
  </section>;
}
