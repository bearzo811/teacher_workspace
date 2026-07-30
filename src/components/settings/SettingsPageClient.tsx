"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";

type SettingsForm = {
  schoolYear: string;
  grade: string;
  className: string;
  currentWeek: string;
  weekOneStartDate: string;
  termEndDate: string;
  chineseStartWeek: string;
  chineseEndWeek: string;
  englishStartWeek: string;
  englishEndWeek: string;
  readingSchoolYear: string;
  readingSemester: "first" | "second";
  allowDisplayHomeworkToggle: boolean;
  allowDisplayPassportToggle: boolean;
  allowDisplayRoutineToggle: boolean;
  allowDisplayReadingToggle: boolean;
  displayCarouselEnabled: boolean;
  displayToken: string;
  displayRefreshSeconds: string;
};

const emptyForm: SettingsForm = {
  schoolYear: "",
  grade: "",
  className: "",
  currentWeek: "",
  weekOneStartDate: "",
  termEndDate: "",
  chineseStartWeek: "",
  chineseEndWeek: "",
  englishStartWeek: "",
  englishEndWeek: "",
  readingSchoolYear: "",
  readingSemester: "first",
  allowDisplayHomeworkToggle: false,
  allowDisplayPassportToggle: false,
  allowDisplayRoutineToggle: false,
  allowDisplayReadingToggle: false,
  displayCarouselEnabled: false,
  displayToken: "",
  displayRefreshSeconds: "20",
};

export function SettingsPageClient() {
  const [form, setForm] = useState<SettingsForm>(emptyForm);
  const [weekProgressLabel, setWeekProgressLabel] = useState<string | null>(
    null,
  );
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
          weekOneStartDate: string;
          termEndDate: string;
          chineseStartWeek: number;
          chineseEndWeek: number;
          englishStartWeek: number;
          englishEndWeek: number;
          weekProgressLabel: string;
          allowDisplayHomeworkToggle: boolean;
          allowDisplayPassportToggle: boolean;
          allowDisplayRoutineToggle: boolean;
          readingSchoolYear: string;
          readingSemester: string;
          allowDisplayReadingToggle: boolean;
          displayCarouselEnabled: boolean;
          displayToken: string;
          displayRefreshSeconds: number;
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
      setWeekProgressLabel(data.weekProgressLabel);
      setForm({
        schoolYear: data.schoolYear,
        grade: String(data.grade),
        className: data.className,
        currentWeek: String(data.currentWeek),
        weekOneStartDate: data.weekOneStartDate ?? "",
        termEndDate: data.termEndDate ?? "",
        chineseStartWeek: String(data.chineseStartWeek),
        chineseEndWeek: String(data.chineseEndWeek),
        englishStartWeek: String(data.englishStartWeek),
        englishEndWeek: String(data.englishEndWeek),
        readingSchoolYear: data.readingSchoolYear ?? "",
        readingSemester:
          data.readingSemester === "second" ? "second" : "first",
        allowDisplayHomeworkToggle: data.allowDisplayHomeworkToggle,
        allowDisplayPassportToggle: data.allowDisplayPassportToggle,
        allowDisplayRoutineToggle: data.allowDisplayRoutineToggle,
        allowDisplayReadingToggle: data.allowDisplayReadingToggle ?? false,
        displayCarouselEnabled: data.displayCarouselEnabled,
        displayToken: data.displayToken ?? "",
        displayRefreshSeconds: String(data.displayRefreshSeconds ?? 20),
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

  function updateField<K extends keyof SettingsForm>(
    key: K,
    value: SettingsForm[K],
  ) {
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
      const displayRefreshSeconds = Number(form.displayRefreshSeconds);
      const weekOneStartDate = form.weekOneStartDate.trim();
      const termEndDate = form.termEndDate.trim();

      if (
        !form.schoolYear.trim() ||
        !form.className.trim() ||
        !Number.isInteger(grade) ||
        !Number.isInteger(currentWeek) ||
        !Number.isInteger(chineseStartWeek) ||
        !Number.isInteger(chineseEndWeek) ||
        !Number.isInteger(englishStartWeek) ||
        !Number.isInteger(englishEndWeek) ||
        !Number.isInteger(displayRefreshSeconds)
      ) {
        throw new Error("請檢查欄位，數字須為整數");
      }
      if (currentWeek < 1 || currentWeek > 25) {
        throw new Error("手動目前週數須為 1～25");
      }
      if (
        chineseStartWeek < 1 ||
        chineseEndWeek > 25 ||
        englishStartWeek < 1 ||
        englishEndWeek > 25
      ) {
        throw new Error("護照起迄週須在 1～25");
      }
      if (chineseStartWeek > chineseEndWeek || englishStartWeek > englishEndWeek) {
        throw new Error("起週不可大於迄週");
      }
      if (
        weekOneStartDate !== "" &&
        !/^\d{4}-\d{2}-\d{2}$/.test(weekOneStartDate)
      ) {
        throw new Error("第一週開啟日格式須為 YYYY-MM-DD");
      }
      if (termEndDate !== "" && !/^\d{4}-\d{2}-\d{2}$/.test(termEndDate)) {
        throw new Error("學期結束日格式須為 YYYY-MM-DD");
      }
      if (
        weekOneStartDate !== "" &&
        termEndDate !== "" &&
        termEndDate < weekOneStartDate
      ) {
        throw new Error("學期結束日不可早於第一週開啟日");
      }
      if (displayRefreshSeconds < 5) {
        throw new Error("大屏刷新秒數至少 5 秒");
      }

      const response = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          schoolYear: form.schoolYear.trim(),
          grade,
          className: form.className.trim(),
          currentWeek,
          weekOneStartDate,
          termEndDate,
          chineseStartWeek,
          chineseEndWeek,
          englishStartWeek,
          englishEndWeek,
          readingSchoolYear: form.readingSchoolYear.trim(),
          readingSemester: form.readingSemester,
          allowDisplayHomeworkToggle: form.allowDisplayHomeworkToggle,
          allowDisplayPassportToggle: form.allowDisplayPassportToggle,
          allowDisplayRoutineToggle: form.allowDisplayRoutineToggle,
          allowDisplayReadingToggle: form.allowDisplayReadingToggle,
          displayCarouselEnabled: form.displayCarouselEnabled,
          displayToken: form.displayToken.trim(),
          displayRefreshSeconds,
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

  const displayHref = form.displayToken.trim()
    ? `/display?token=${encodeURIComponent(form.displayToken.trim())}`
    : "/display";
  const displayLabel = form.displayToken.trim()
    ? `/display?token=${form.displayToken.trim()}`
    : "/display";
  const hasWeekOne = form.weekOneStartDate.trim() !== "";

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <header>
        <h1 className="text-2xl font-semibold text-gray-900">系統設定</h1>
        <p className="mt-1 text-sm text-gray-500">
          班級資料、學期週次、護照起迄週、教室大屏
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
        </div>
      </Card>

      <Card>
        <CardTitle>學期週次</CardTitle>
        <CardDescription>
          填開啟日／結束日後系統自動推算目前週。早於開啟日：7／8＝暑假、1／2＝寒假。
          晚於結束日：學期結束（寒暑假月改標寒暑假）。結束日當天仍算學期中。未填開啟日則用手動週數。
        </CardDescription>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <Field
            label="第一週開啟日"
            type="date"
            value={form.weekOneStartDate}
            onChange={(value) => updateField("weekOneStartDate", value)}
          />
          <Field
            label="學期結束日"
            type="date"
            value={form.termEndDate}
            onChange={(value) => updateField("termEndDate", value)}
          />
          <Field
            label={
              hasWeekOne
                ? "手動備援週數（未設開啟日時用）"
                : "目前週數（手動）"
            }
            type="number"
            value={form.currentWeek}
            onChange={(value) => updateField("currentWeek", value)}
            className="sm:col-span-2"
          />
        </div>
        {weekProgressLabel ? (
          <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700">
            系統判定：
            <span className="font-semibold">{weekProgressLabel}</span>
          </p>
        ) : null}
      </Card>

      <Card>
        <CardTitle>國語護照</CardTitle>
        <CardDescription>完成區間建議第 3～16 週（可改，範圍 1～25）</CardDescription>
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
        <CardDescription>完成區間建議第 3～16 週（可改，範圍 1～25）</CardDescription>
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

      <Card>
        <CardTitle>閱讀總表</CardTitle>
        <CardDescription>
          上學期 9–12 月、下學期 3–6 月（1、2、7、8 月除外）。空白學年＝依月份自動建議。
        </CardDescription>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <Field
            label="閱讀學年度（可空白＝跟班級學年＋自動學期）"
            value={form.readingSchoolYear}
            onChange={(value) => updateField("readingSchoolYear", value)}
          />
          <div className="flex flex-col gap-2 text-sm text-gray-700">
            <span>學期</span>
            <label className="flex items-center gap-2">
              <input
                type="radio"
                checked={form.readingSemester === "first"}
                onChange={() => updateField("readingSemester", "first")}
              />
              上學期（9–12）
            </label>
            <label className="flex items-center gap-2">
              <input
                type="radio"
                checked={form.readingSemester === "second"}
                onChange={() => updateField("readingSemester", "second")}
              />
              下學期（3–6）
            </label>
          </div>
        </div>
      </Card>

      <Card>
        <CardTitle>教室大屏</CardTitle>
        <CardDescription>
          教室電腦開{" "}
          <a
            href={displayHref}
            target="_blank"
            rel="noreferrer"
            className="text-blue-600 underline"
          >
            {displayLabel}
          </a>
        </CardDescription>
        <div className="mt-4 space-y-3">
          <Toggle
            label="允許大屏自助打勾作業"
            checked={form.allowDisplayHomeworkToggle}
            onChange={(value) =>
              updateField("allowDisplayHomeworkToggle", value)
            }
          />
          <Toggle
            label="允許大屏自助點護照（未開始／缺家長／完成；可補他週）"
            checked={form.allowDisplayPassportToggle}
            onChange={(value) =>
              updateField("allowDisplayPassportToggle", value)
            }
          />
          <Toggle
            label="允許大屏自助勾每日任務／已抄聯絡簿"
            checked={form.allowDisplayRoutineToggle}
            onChange={(value) =>
              updateField("allowDisplayRoutineToggle", value)
            }
          />
          <Toggle
            label="允許大屏自助點閱讀總表（讀報／心得三態）"
            checked={form.allowDisplayReadingToggle}
            onChange={(value) =>
              updateField("allowDisplayReadingToggle", value)
            }
          />
          <Toggle
            label="面板自動輪播（每 60 秒）"
            checked={form.displayCarouselEnabled}
            onChange={(value) => updateField("displayCarouselEnabled", value)}
          />
          <Field
            label="刷新秒數（≥5，近即時同步用較小值）"
            type="number"
            value={form.displayRefreshSeconds}
            onChange={(value) => updateField("displayRefreshSeconds", value)}
          />
          <Field
            label="存取碼（空白＝不驗證；有填則網址需 ?token=）"
            value={form.displayToken}
            onChange={(value) => updateField("displayToken", value)}
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

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-3 text-sm text-gray-700">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="h-4 w-4 rounded border-gray-300"
      />
      {label}
    </label>
  );
}
