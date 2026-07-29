"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";

type SettingsForm = {
  schoolYear: string;
  grade: string;
  className: string;
  currentWeek: string;
  chineseStartWeek: string;
  chineseEndWeek: string;
  englishStartWeek: string;
  englishEndWeek: string;
};

const emptyForm: SettingsForm = {
  schoolYear: "",
  grade: "",
  className: "",
  currentWeek: "",
  chineseStartWeek: "",
  chineseEndWeek: "",
  englishStartWeek: "",
  englishEndWeek: "",
};

export function SettingsPageClient() {
  const [form, setForm] = useState<SettingsForm>(emptyForm);
  const [activeCount, setActiveCount] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [settingsRes, studentsRes] = await Promise.all([
        fetch("/api/settings"),
        fetch("/api/students"),
      ]);
      const settingsJson = (await settingsRes.json()) as {
        data?: {
          schoolYear: string;
          grade: number;
          className: string;
          currentWeek: number;
          chineseStartWeek: number;
          chineseEndWeek: number;
          englishStartWeek: number;
          englishEndWeek: number;
        };
        error?: string;
      };
      const studentsJson = (await studentsRes.json()) as {
        data?: unknown[];
        error?: string;
      };

      if (!settingsRes.ok) {
        throw new Error(settingsJson.error ?? "讀取設定失敗");
      }
      if (!studentsRes.ok) {
        throw new Error(studentsJson.error ?? "讀取學生數失敗");
      }

      const data = settingsJson.data!;
      setForm({
        schoolYear: data.schoolYear,
        grade: String(data.grade),
        className: data.className,
        currentWeek: String(data.currentWeek),
        chineseStartWeek: String(data.chineseStartWeek),
        chineseEndWeek: String(data.chineseEndWeek),
        englishStartWeek: String(data.englishStartWeek),
        englishEndWeek: String(data.englishEndWeek),
      });
      setActiveCount(studentsJson.data?.length ?? 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : "讀取設定失敗");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function updateField(key: keyof SettingsForm, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const grade = Number(form.grade);
      const currentWeek = Number(form.currentWeek);
      const chineseStartWeek = Number(form.chineseStartWeek);
      const chineseEndWeek = Number(form.chineseEndWeek);
      const englishStartWeek = Number(form.englishStartWeek);
      const englishEndWeek = Number(form.englishEndWeek);

      if (
        !form.schoolYear.trim() ||
        !form.className.trim() ||
        !Number.isInteger(grade) ||
        !Number.isInteger(currentWeek) ||
        !Number.isInteger(chineseStartWeek) ||
        !Number.isInteger(chineseEndWeek) ||
        !Number.isInteger(englishStartWeek) ||
        !Number.isInteger(englishEndWeek)
      ) {
        throw new Error("請檢查欄位，數字須為整數");
      }
      if (chineseStartWeek > chineseEndWeek || englishStartWeek > englishEndWeek) {
        throw new Error("起週不可大於迄週");
      }

      const response = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          schoolYear: form.schoolYear.trim(),
          grade,
          className: form.className.trim(),
          currentWeek,
          chineseStartWeek,
          chineseEndWeek,
          englishStartWeek,
          englishEndWeek,
        }),
      });
      const json = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(json.error ?? "儲存失敗");
      }
      setMessage("已儲存");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "儲存失敗");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <header>
        <h1 className="text-2xl font-semibold text-gray-900">系統設定</h1>
        <p className="mt-1 text-sm text-gray-500">
          班級資料、目前週數、護照起迄週
        </p>
      </header>

      {loading ? <p className="text-sm text-gray-400">載入中…</p> : null}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {message ? <p className="text-sm text-green-600">{message}</p> : null}

      <Card>
        <CardTitle>基本資料</CardTitle>
        <CardDescription>
          在籍學生數：{activeCount === null ? "—" : activeCount}
        </CardDescription>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <Field
            label="學年度"
            value={form.schoolYear}
            onChange={(value) => updateField("schoolYear", value)}
          />
          <Field
            label="年級"
            type="number"
            value={form.grade}
            onChange={(value) => updateField("grade", value)}
          />
          <Field
            label="班級"
            value={form.className}
            onChange={(value) => updateField("className", value)}
            className="sm:col-span-2"
          />
          <Field
            label="目前週數"
            type="number"
            value={form.currentWeek}
            onChange={(value) => updateField("currentWeek", value)}
          />
        </div>
      </Card>

      <Card>
        <CardTitle>國語護照</CardTitle>
        <CardDescription>起迄週設定</CardDescription>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <Field
            label="開始週"
            type="number"
            value={form.chineseStartWeek}
            onChange={(value) => updateField("chineseStartWeek", value)}
          />
          <Field
            label="結束週"
            type="number"
            value={form.chineseEndWeek}
            onChange={(value) => updateField("chineseEndWeek", value)}
          />
        </div>
      </Card>

      <Card>
        <CardTitle>英語護照</CardTitle>
        <CardDescription>起迄週設定</CardDescription>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <Field
            label="開始週"
            type="number"
            value={form.englishStartWeek}
            onChange={(value) => updateField("englishStartWeek", value)}
          />
          <Field
            label="結束週"
            type="number"
            value={form.englishEndWeek}
            onChange={(value) => updateField("englishEndWeek", value)}
          />
        </div>
      </Card>

      <div>
        <Button
          disabled={loading || saving}
          onClick={() => {
            void handleSave();
          }}
        >
          {saving ? "儲存中…" : "儲存設定"}
        </Button>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  className,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  className?: string;
}) {
  return (
    <label className={`flex flex-col gap-1 text-sm text-gray-700 ${className ?? ""}`}>
      {label}
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-10 rounded-lg border border-gray-200 px-3 outline-none ring-blue-500 focus:ring-2"
      />
    </label>
  );
}
