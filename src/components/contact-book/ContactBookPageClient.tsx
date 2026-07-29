"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { HOMEWORK_TEMPLATES } from "@/types/homework";

function formatDateInput(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function tomorrowDateString() {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  return formatDateInput(date);
}

function formatDisplayDate(dateStr: string) {
  const date = new Date(`${dateStr}T00:00:00`);
  const weekdays = ["日", "一", "二", "三", "四", "五", "六"];
  return `${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()}（${weekdays[date.getDay()]}）`;
}

type ContactBookData = {
  date: string;
  note: string;
  titles: string[];
  className: string;
  schoolYear: string;
};

export function ContactBookPageClient() {
  const [date, setDate] = useState(tomorrowDateString);
  const [titles, setTitles] = useState<string[]>([]);
  const [note, setNote] = useState("");
  const [meta, setMeta] = useState({ className: "", schoolYear: "" });
  const [customTitle, setCustomTitle] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async (selectedDate: string) => {
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch(
        `/api/contact-book?date=${encodeURIComponent(selectedDate)}`,
      );
      const json = (await response.json()) as {
        data?: ContactBookData;
        error?: string;
      };
      if (!response.ok) {
        throw new Error(json.error ?? "讀取失敗");
      }
      const data = json.data!;
      setTitles(data.titles);
      setNote(data.note);
      setMeta({ className: data.className, schoolYear: data.schoolYear });
    } catch (err) {
      setError(err instanceof Error ? err.message : "讀取失敗");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(date);
  }, [date, load]);

  const availableTemplates = useMemo(
    () => HOMEWORK_TEMPLATES.filter((title) => !titles.includes(title)),
    [titles],
  );

  function addTitle(title: string) {
    const cleaned = title.trim();
    if (!cleaned || titles.includes(cleaned)) return;
    setTitles((prev) => [...prev, cleaned]);
  }

  function removeTitle(title: string) {
    setTitles((prev) => prev.filter((item) => item !== title));
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch("/api/contact-book", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date, titles, note }),
      });
      const json = (await response.json()) as {
        data?: ContactBookData;
        error?: string;
      };
      if (!response.ok) {
        throw new Error(json.error ?? "儲存失敗");
      }
      setTitles(json.data!.titles);
      setNote(json.data!.note);
      setMessage("已儲存，並同步到該日作業管理");
    } catch (err) {
      setError(err instanceof Error ? err.message : "儲存失敗");
    } finally {
      setSaving(false);
    }
  }

  function handlePrint() {
    window.print();
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <header className="flex flex-col gap-3 print:hidden sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">聯絡簿</h1>
          <p className="mt-1 text-sm text-gray-500">
            編輯後儲存，會同步寫入該日作業（可改、會跟著改）
          </p>
        </div>
        <label className="text-sm text-gray-600">
          對象日期
          <input
            type="date"
            value={date}
            onChange={(event) => setDate(event.target.value)}
            className="ml-2 h-10 rounded-lg border border-gray-200 px-3 text-sm outline-none ring-blue-500 focus:ring-2"
          />
        </label>
      </header>

      {error ? (
        <p className="text-sm text-red-600 print:hidden">{error}</p>
      ) : null}
      {message ? (
        <p className="text-sm text-green-600 print:hidden">{message}</p>
      ) : null}
      {loading ? (
        <p className="text-sm text-gray-400 print:hidden">載入中…</p>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="flex flex-col gap-4 print:hidden">
          <Card>
            <CardTitle>作業項目</CardTitle>
            <CardDescription>模板 + 自由新增</CardDescription>

            <div className="mt-4 flex flex-wrap gap-2">
              {availableTemplates.map((title) => (
                <button
                  key={title}
                  type="button"
                  onClick={() => addTitle(title)}
                  className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
                >
                  ＋ {title}
                </button>
              ))}
            </div>

            <div className="mt-3 flex gap-2">
              <input
                type="text"
                value={customTitle}
                onChange={(event) => setCustomTitle(event.target.value)}
                placeholder="其他項目"
                className="h-10 flex-1 rounded-lg border border-gray-200 px-3 text-sm outline-none ring-blue-500 focus:ring-2"
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    addTitle(customTitle);
                    setCustomTitle("");
                  }
                }}
              />
              <Button
                variant="secondary"
                onClick={() => {
                  addTitle(customTitle);
                  setCustomTitle("");
                }}
              >
                加入
              </Button>
            </div>

            <ul className="mt-4 space-y-2">
              {titles.length === 0 ? (
                <li className="text-sm text-gray-400">尚未加入項目</li>
              ) : (
                titles.map((title) => (
                  <li
                    key={title}
                    className="flex items-center justify-between rounded-lg border border-gray-100 px-3 py-2 text-sm"
                  >
                    <span>{title}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-red-600"
                      onClick={() => removeTitle(title)}
                    >
                      移除
                    </Button>
                  </li>
                ))
              )}
            </ul>
          </Card>

          <Card>
            <CardTitle>叮嚀／備註</CardTitle>
            <CardDescription>只顯示在聯絡簿，不進作業打勾表</CardDescription>
            <textarea
              value={note}
              onChange={(event) => setNote(event.target.value)}
              rows={4}
              placeholder="例如：明天帶美勞用具、段考複習…"
              className="mt-3 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none ring-blue-500 focus:ring-2"
            />
          </Card>

          <div className="flex flex-wrap gap-2">
            <Button
              disabled={loading || saving}
              onClick={() => {
                void handleSave();
              }}
            >
              {saving ? "儲存中…" : "儲存並同步作業"}
            </Button>
            <Button variant="secondary" onClick={handlePrint}>
              列印／預覽
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                setDate(tomorrowDateString());
              }}
            >
              設為明天
            </Button>
          </div>
        </div>

        <div className="print:w-full">
          <Card className="print:border-0 print:shadow-none">
            <div className="print:p-0">
              <p className="text-center text-lg font-semibold text-gray-900">
                {meta.schoolYear ? `${meta.schoolYear} 學年度` : ""}{" "}
                {meta.className || "班級"} 聯絡簿
              </p>
              <p className="mt-2 text-center text-sm text-gray-600">
                {formatDisplayDate(date)}
              </p>

              <div className="mt-6">
                <p className="text-sm font-semibold text-gray-800">今日作業</p>
                {titles.length === 0 ? (
                  <p className="mt-2 text-sm text-gray-400">（無）</p>
                ) : (
                  <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-gray-800">
                    {titles.map((title) => (
                      <li key={title}>{title}</li>
                    ))}
                  </ol>
                )}
              </div>

              {note.trim() ? (
                <div className="mt-6">
                  <p className="text-sm font-semibold text-gray-800">叮嚀</p>
                  <p className="mt-2 whitespace-pre-wrap text-sm text-gray-800">
                    {note}
                  </p>
                </div>
              ) : null}

              <div className="mt-10 grid grid-cols-2 gap-6 text-sm text-gray-600">
                <div className="border-t border-gray-300 pt-2">家長簽章</div>
                <div className="border-t border-gray-300 pt-2">導師簽章</div>
              </div>
            </div>
          </Card>
          <p className="mt-2 text-xs text-gray-400 print:hidden">
            右側為聯絡簿預覽；按「列印／預覽」可列印或另存 PDF。
          </p>
        </div>
      </div>
    </div>
  );
}
