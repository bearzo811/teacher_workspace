"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { TermManagerCard } from "@/components/calendar/TermManagerCard";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";

type SettingsForm = {
  schoolYear: string;
  grade: string;
  className: string;
  chineseStartWeek: string;
  chineseEndWeek: string;
  englishStartWeek: string;
  englishEndWeek: string;
  allowDisplayHomeworkToggle: boolean;
  allowDisplayPassportToggle: boolean;
  allowDisplayRoutineToggle: boolean;
  allowDisplayReadingToggle: boolean;
  displayCarouselEnabled: boolean;
  displayToken: string;
  displayRefreshSeconds: string;
  homeworkOnTimeCoins: string;
  homeworkLateCoins: string;
  homeworkMissedCoins: string;
  passportOnTimeCoins: string;
  passportLateCoins: string;
  passportMissedCoins: string;
  routineXp: string;
  levelBaseXp: string;
};

const emptyForm: SettingsForm = {
  schoolYear: "",
  grade: "",
  className: "",
  chineseStartWeek: "",
  chineseEndWeek: "",
  englishStartWeek: "",
  englishEndWeek: "",
  allowDisplayHomeworkToggle: false,
  allowDisplayPassportToggle: false,
  allowDisplayRoutineToggle: false,
  allowDisplayReadingToggle: false,
  displayCarouselEnabled: false,
  displayToken: "",
  displayRefreshSeconds: "20",
  homeworkOnTimeCoins: "2",
  homeworkLateCoins: "1",
  homeworkMissedCoins: "-1",
  passportOnTimeCoins: "5",
  passportLateCoins: "2",
  passportMissedCoins: "-2",
  routineXp: "2",
  levelBaseXp: "100",
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
          chineseStartWeek: number;
          chineseEndWeek: number;
          englishStartWeek: number;
          englishEndWeek: number;
          allowDisplayHomeworkToggle: boolean;
          allowDisplayPassportToggle: boolean;
          allowDisplayRoutineToggle: boolean;
          allowDisplayReadingToggle: boolean;
          displayCarouselEnabled: boolean;
          displayToken: string;
          displayRefreshSeconds: number;
          gamification: {
            homeworkOnTimeCoins: number;
            homeworkLateCoins: number;
            homeworkMissedCoins: number;
            passportOnTimeCoins: number;
            passportLateCoins: number;
            passportMissedCoins: number;
            routineXp: number;
            levelBaseXp: number;
          };
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
        chineseStartWeek: String(data.chineseStartWeek),
        chineseEndWeek: String(data.chineseEndWeek),
        englishStartWeek: String(data.englishStartWeek),
        englishEndWeek: String(data.englishEndWeek),
        allowDisplayHomeworkToggle: data.allowDisplayHomeworkToggle,
        allowDisplayPassportToggle: data.allowDisplayPassportToggle,
        allowDisplayRoutineToggle: data.allowDisplayRoutineToggle,
        allowDisplayReadingToggle: data.allowDisplayReadingToggle ?? false,
        displayCarouselEnabled: data.displayCarouselEnabled,
        displayToken: data.displayToken ?? "",
        displayRefreshSeconds: String(data.displayRefreshSeconds ?? 20),
        homeworkOnTimeCoins: String(data.gamification.homeworkOnTimeCoins),
        homeworkLateCoins: String(data.gamification.homeworkLateCoins),
        homeworkMissedCoins: String(data.gamification.homeworkMissedCoins),
        passportOnTimeCoins: String(data.gamification.passportOnTimeCoins),
        passportLateCoins: String(data.gamification.passportLateCoins),
        passportMissedCoins: String(data.gamification.passportMissedCoins),
        routineXp: String(data.gamification.routineXp),
        levelBaseXp: String(data.gamification.levelBaseXp),
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
      const chineseStartWeek = Number(form.chineseStartWeek);
      const chineseEndWeek = Number(form.chineseEndWeek);
      const englishStartWeek = Number(form.englishStartWeek);
      const englishEndWeek = Number(form.englishEndWeek);
      const displayRefreshSeconds = Number(form.displayRefreshSeconds);
      const gameNumbers = {
        homeworkOnTimeCoins: Number(form.homeworkOnTimeCoins),
        homeworkLateCoins: Number(form.homeworkLateCoins),
        homeworkMissedCoins: Number(form.homeworkMissedCoins),
        passportOnTimeCoins: Number(form.passportOnTimeCoins),
        passportLateCoins: Number(form.passportLateCoins),
        passportMissedCoins: Number(form.passportMissedCoins),
        routineXp: Number(form.routineXp),
        levelBaseXp: Number(form.levelBaseXp),
      };

      if (
        !form.schoolYear.trim() ||
        !form.className.trim() ||
        !Number.isInteger(grade) ||
        !Number.isInteger(chineseStartWeek) ||
        !Number.isInteger(chineseEndWeek) ||
        !Number.isInteger(englishStartWeek) ||
        !Number.isInteger(englishEndWeek) ||
        !Number.isInteger(displayRefreshSeconds) ||
        Object.values(gameNumbers).some((value) => !Number.isInteger(value))
      ) {
        throw new Error("請檢查欄位，數字須為整數");
      }
      if (
        chineseStartWeek < 1 ||
        chineseEndWeek > 25 ||
        englishStartWeek < 1 ||
        englishEndWeek > 25
      ) {
        throw new Error("護照起迄週須在 1～25");
      }
      if (
        chineseStartWeek > chineseEndWeek ||
        englishStartWeek > englishEndWeek
      ) {
        throw new Error("起週不可大於迄週");
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
          chineseStartWeek,
          chineseEndWeek,
          englishStartWeek,
          englishEndWeek,
          allowDisplayHomeworkToggle: form.allowDisplayHomeworkToggle,
          allowDisplayPassportToggle: form.allowDisplayPassportToggle,
          allowDisplayRoutineToggle: form.allowDisplayRoutineToggle,
          allowDisplayReadingToggle: form.allowDisplayReadingToggle,
          displayCarouselEnabled: form.displayCarouselEnabled,
          displayToken: form.displayToken.trim(),
          displayRefreshSeconds,
          gamification: gameNumbers,
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
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <header>
        <h1 className="text-2xl font-semibold text-gray-900">系統設定</h1>
        <p className="mt-1 text-sm text-gray-500">
          班級資料、學期設定、護照起迄週、教室大屏
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

      <TermManagerCard />

      <details className="rounded-xl border border-gray-200 bg-white px-6 py-4 shadow-sm">
        <summary className="cursor-pointer text-sm font-medium text-gray-600">
          護照週次進階設定（平時不需調整）
        </summary>
        <div className="mt-5 grid gap-5 lg:grid-cols-2">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">國語護照</h2>
            <p className="mt-1 text-sm text-gray-500">完成區間第 3～16 週</p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <Field label="開始週" type="number" value={form.chineseStartWeek} onChange={(value) => updateField("chineseStartWeek", value)} />
              <Field label="結束週" type="number" value={form.chineseEndWeek} onChange={(value) => updateField("chineseEndWeek", value)} />
            </div>
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900">英語護照</h2>
            <p className="mt-1 text-sm text-gray-500">完成區間第 3～16 週</p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <Field label="開始週" type="number" value={form.englishStartWeek} onChange={(value) => updateField("englishStartWeek", value)} />
              <Field label="結束週" type="number" value={form.englishEndWeek} onChange={(value) => updateField("englishEndWeek", value)} />
            </div>
          </div>
        </div>
      </details>

      <Card>
        <CardTitle>學生養成</CardTitle>
        <CardDescription>
          數值調整只影響之後的新事件，不會重算既有帳本。逾期補交保留扣款，另發較少金幣。
        </CardDescription>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <Field
            label="作業準時完成（金幣）"
            type="number"
            value={form.homeworkOnTimeCoins}
            onChange={(value) => updateField("homeworkOnTimeCoins", value)}
          />
          <Field
            label="作業逾期補交（金幣）"
            type="number"
            value={form.homeworkLateCoins}
            onChange={(value) => updateField("homeworkLateCoins", value)}
          />
          <Field
            label="作業逾期未交（負數）"
            type="number"
            value={form.homeworkMissedCoins}
            onChange={(value) => updateField("homeworkMissedCoins", value)}
          />
          <Field
            label="護照準時完成（金幣）"
            type="number"
            value={form.passportOnTimeCoins}
            onChange={(value) => updateField("passportOnTimeCoins", value)}
          />
          <Field
            label="護照逾期補完（金幣）"
            type="number"
            value={form.passportLateCoins}
            onChange={(value) => updateField("passportLateCoins", value)}
          />
          <Field
            label="護照逾期未完成（負數）"
            type="number"
            value={form.passportMissedCoins}
            onChange={(value) => updateField("passportMissedCoins", value)}
          />
          <Field
            label="每項生活習慣（XP）"
            type="number"
            value={form.routineXp}
            onChange={(value) => updateField("routineXp", value)}
          />
          <Field
            label="升級基數 XP（下一級＝基數×目前等級）"
            type="number"
            value={form.levelBaseXp}
            onChange={(value) => updateField("levelBaseXp", value)}
          />
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

      <Card>
        <CardTitle>學期資料匯出</CardTitle>
        <CardDescription>下載 UTF-8 CSV，可直接以 Excel 或試算表開啟。</CardDescription>
        <div className="mt-4 flex flex-wrap gap-2">
          {[
            ["students", "名冊"],
            ["homework", "作業狀態"],
            ["daily-tasks", "每日任務"],
            ["points", "點數紀錄"],
            ["shop", "商店紀錄"],
          ].map(([type, label]) => (
            <a key={type} href={`/api/export?type=${type}`} className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50">
              匯出{label}
            </a>
          ))}
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
    <label
      className={`flex flex-col gap-1 text-sm text-gray-700 ${className ?? ""}`}
    >
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
