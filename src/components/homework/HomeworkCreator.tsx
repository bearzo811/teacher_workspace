"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { HOMEWORK_TEMPLATES } from "@/types/homework";

type HomeworkCreatorProps = {
  date: string;
  existingTitles: string[];
  pending?: boolean;
  onCreated: () => void;
};

export function HomeworkCreator({
  date,
  existingTitles,
  pending,
  onCreated,
}: HomeworkCreatorProps) {
  const [selected, setSelected] = useState<string[]>([]);
  const [customTitle, setCustomTitle] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const availableTemplates = useMemo(
    () =>
      HOMEWORK_TEMPLATES.filter((title) => !existingTitles.includes(title)),
    [existingTitles],
  );

  function toggleTemplate(title: string) {
    setSelected((prev) =>
      prev.includes(title)
        ? prev.filter((item) => item !== title)
        : [...prev, title],
    );
  }

  async function handleCreate() {
    setError(null);
    const titles = [
      ...selected,
      ...(customTitle.trim() ? [customTitle.trim()] : []),
    ];
    if (titles.length === 0) {
      setError("請勾選模板或輸入作業名稱");
      return;
    }

    setSaving(true);
    try {
      const response = await fetch("/api/homework", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date, titles }),
      });
      const json = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(json.error ?? "新增失敗");
      }
      setSelected([]);
      setCustomTitle("");
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "新增失敗");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardTitle>建立今日作業</CardTitle>
      <CardDescription>模板勾選 + 可自由新增</CardDescription>

      <div className="mt-4 flex flex-wrap gap-2">
        {availableTemplates.length === 0 ? (
          <p className="text-sm text-gray-400">今日模板皆已建立</p>
        ) : (
          availableTemplates.map((title) => {
            const checked = selected.includes(title);
            return (
              <button
                key={title}
                type="button"
                onClick={() => toggleTemplate(title)}
                className={`rounded-lg border px-3 py-1.5 text-sm ${
                  checked
                    ? "border-blue-600 bg-blue-50 text-blue-700"
                    : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
                }`}
              >
                {title}
              </button>
            );
          })
        )}
      </div>

      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <input
          type="text"
          value={customTitle}
          onChange={(event) => setCustomTitle(event.target.value)}
          placeholder="其他作業名稱"
          className="h-10 flex-1 rounded-lg border border-gray-200 px-3 text-sm outline-none ring-blue-500 focus:ring-2"
        />
        <Button
          disabled={pending || saving}
          onClick={() => {
            void handleCreate();
          }}
        >
          {saving ? "建立中…" : "建立"}
        </Button>
      </div>
      {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}
    </Card>
  );
}
