"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import type { TermView } from "@/services/termService";

type TermDraft = {
  name: string;
  schoolYear: string;
  startsOn: string;
  endsOn: string;
};

const initialDraft: TermDraft = {
  name: "上學期",
  schoolYear: "115",
  startsOn: "",
  endsOn: "",
};

export function TermManagerCard() {
  const [terms, setTerms] = useState<TermView[]>([]);
  const [activeTermId, setActiveTermId] = useState<string | null>(null);
  const [draft, setDraft] = useState<TermDraft>(initialDraft);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/terms");
      const json = (await response.json()) as {
        data?: TermView[];
        activeTerm?: TermView | null;
        error?: string;
      };
      if (!response.ok) throw new Error(json.error ?? "讀取學期失敗");
      setTerms(json.data ?? []);
      setActiveTermId(json.activeTerm?.id ?? null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "讀取學期失敗");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function createTerm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch("/api/terms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      const json = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(json.error ?? "建立學期失敗");
      setDraft((current) => ({ ...current, startsOn: "", endsOn: "" }));
      setMessage("已建立學期；第一個學期會自動啟用。");
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "建立學期失敗");
    } finally {
      setSaving(false);
    }
  }

  async function activateTerm(term: TermView) {
    if (!window.confirm(`切換為「${term.name}」後，後續上課日判定會改用此學期。確定切換？`)) {
      return;
    }
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch("/api/terms", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: term.id, action: "activate" }),
      });
      const json = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(json.error ?? "切換學期失敗");
      setMessage(`目前使用「${term.name}」。`);
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "切換學期失敗");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardTitle>學期設定</CardTitle>
      <CardDescription>
        上課日以啟用學期的起訖日為範圍，並套用月曆中的放假／補課設定。
      </CardDescription>
      {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
      {message ? <p className="mt-3 text-sm text-green-600">{message}</p> : null}

      <div className="mt-4 grid gap-5 lg:grid-cols-[1fr_1.4fr]">
        <form className="grid gap-3" onSubmit={createTerm}>
          <p className="text-sm font-medium text-gray-800">建立新學期</p>
          <label className="grid gap-1 text-sm text-gray-700">
            學年度
            <input
              className="h-10 rounded-lg border border-gray-300 px-3"
              onChange={(event) => setDraft((current) => ({ ...current, schoolYear: event.target.value }))}
              required
              value={draft.schoolYear}
            />
          </label>
          <label className="grid gap-1 text-sm text-gray-700">
            學期名稱
            <input
              className="h-10 rounded-lg border border-gray-300 px-3"
              onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))}
              required
              value={draft.name}
            />
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="grid gap-1 text-sm text-gray-700">
              開始日
              <input
                className="h-10 rounded-lg border border-gray-300 px-3"
                onChange={(event) => setDraft((current) => ({ ...current, startsOn: event.target.value }))}
                required
                type="date"
                value={draft.startsOn}
              />
            </label>
            <label className="grid gap-1 text-sm text-gray-700">
              結束日
              <input
                className="h-10 rounded-lg border border-gray-300 px-3"
                onChange={(event) => setDraft((current) => ({ ...current, endsOn: event.target.value }))}
                required
                type="date"
                value={draft.endsOn}
              />
            </label>
          </div>
          <Button disabled={saving} type="submit">
            {saving ? "儲存中…" : "建立學期"}
          </Button>
        </form>

        <div>
          <p className="text-sm font-medium text-gray-800">已建立的學期</p>
          <div className="mt-3 space-y-2">
            {loading ? <p className="text-sm text-gray-400">載入中…</p> : null}
            {!loading && terms.length === 0 ? (
              <p className="text-sm text-gray-400">尚未建立學期</p>
            ) : null}
            {terms.map((term) => {
              const active = term.id === activeTermId;
              return (
                <div
                  className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-gray-200 px-3 py-2"
                  key={term.id}
                >
                  <div>
                    <p className="font-medium text-gray-900">
                      {term.schoolYear} 學年度 {term.name}
                      {active ? <span className="ml-2 text-sm text-green-700">目前使用</span> : null}
                    </p>
                    <p className="text-sm text-gray-500">
                      {term.startsOn} ～ {term.endsOn}
                    </p>
                  </div>
                  {!active ? (
                    <Button disabled={saving} onClick={() => void activateTerm(term)} size="sm" variant="secondary">
                      切換使用
                    </Button>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </Card>
  );
}
