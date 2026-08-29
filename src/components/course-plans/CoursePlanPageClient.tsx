"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Plus,
  Send,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  formatDateInput,
  parseDateInput,
  todayDateString,
} from "@/lib/dates";

type Subject = "chinese" | "math";
type PublishStatus = "unpublished" | "published" | "outdated";

type PlanAssignment = {
  id: string;
  bookId: string;
  bookName: string;
  pageLabel: string;
  note: string;
  publishedHomeworkId: string | null;
  publishStatus: PublishStatus;
};

type PlanDay = {
  date: string;
  isHoliday: boolean;
  hasClass: boolean;
  calendarTitles: string[];
  inTerm: boolean;
  editable: boolean;
  termName: string | null;
  unit: string;
  plannedContent: string;
  assignments: PlanAssignment[];
};

type WeekData = {
  weekStart: string;
  weekEnd: string;
  weekNumber: number | null;
  weekLabel: string | null;
  subject: Subject;
  activeTermName: string | null;
  days: PlanDay[];
};

type HomeworkBook = {
  id: string;
  name: string;
  subjectName: string | null;
};

const subjects: { key: Subject; label: string }[] = [
  { key: "chinese", label: "國語" },
  { key: "math", label: "數學" },
];

function mondayOf(dateString: string) {
  const date = parseDateInput(dateString);
  const day = date.getDay();
  date.setDate(date.getDate() - (day === 0 ? 6 : day - 1));
  return formatDateInput(date);
}

function shiftWeek(weekStart: string, offset: number) {
  const date = parseDateInput(weekStart);
  date.setDate(date.getDate() + offset * 7);
  return formatDateInput(date);
}

function dayTitle(dateString: string) {
  const date = parseDateInput(dateString);
  const weekdays = ["日", "一", "二", "三", "四", "五", "六"];
  return `${date.getMonth() + 1}/${date.getDate()}（${weekdays[date.getDay()]}）`;
}

function subjectLabel(subject: Subject) {
  return subjects.find((item) => item.key === subject)?.label ?? "";
}

export function CoursePlanPageClient() {
  const [subject, setSubject] = useState<Subject>("chinese");
  const [weekStart, setWeekStart] = useState(() =>
    mondayOf(todayDateString()),
  );
  const [week, setWeek] = useState<WeekData | null>(null);
  const [books, setBooks] = useState<HomeworkBook[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (start: string, selected: Subject) => {
    setLoading(true);
    setError(null);
    try {
      const [planResponse, bookResponse] = await Promise.all([
        fetch(
          `/api/course-plans?weekStart=${encodeURIComponent(start)}&subject=${selected}`,
        ),
        fetch("/api/homework-books?activeOnly=1"),
      ]);
      const planJson = (await planResponse.json()) as {
        data?: WeekData;
        error?: string;
      };
      const bookJson = (await bookResponse.json()) as {
        data?: HomeworkBook[];
        error?: string;
      };
      if (!planResponse.ok) {
        throw new Error(planJson.error ?? "讀取課程計劃失敗");
      }
      if (!bookResponse.ok) {
        throw new Error(bookJson.error ?? "讀取簿本失敗");
      }
      setWeek(planJson.data ?? null);
      setBooks(bookJson.data ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "讀取課程計劃失敗");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(weekStart, subject);
  }, [load, subject, weekStart]);

  const subjectBooks = useMemo(() => {
    const label = subjectLabel(subject);
    return books.filter((book) => book.subjectName === label);
  }, [books, subject]);

  const dateRange = week
    ? `${week.weekStart.replaceAll("-", "/")}－${week.weekEnd.replaceAll("-", "/")}`
    : "讀取週次中…";

  return (
    <div className="flex h-[calc(100dvh-3rem)] min-h-0 flex-col gap-3 overflow-hidden md:h-[calc(100dvh-4rem)]">
      <header className="flex shrink-0 flex-col gap-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <h1 className="text-xl font-semibold text-gray-900">課程計劃</h1>
            {week?.weekLabel ? (
              <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-sm font-semibold text-blue-700">
                {week.weekLabel}
              </span>
            ) : null}
            <p className="text-sm text-gray-600">{dateRange}</p>
            <p className="text-xs text-gray-400">
              {week?.activeTermName
                ? week.activeTermName
                : "尚未設定目前學期"}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setWeekStart((current) => shiftWeek(current, -1))}
            >
              <ChevronLeft className="h-4 w-4" />
              上一週
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setWeekStart(mondayOf(todayDateString()))}
            >
              本週
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setWeekStart((current) => shiftWeek(current, 1))}
            >
              下一週
              <ChevronRight className="h-4 w-4" />
            </Button>
            <label className="flex h-8 items-center gap-2 rounded-lg border border-gray-200 bg-white px-2 text-sm text-gray-600">
              <CalendarDays className="h-4 w-4" />
              <input
                type="date"
                value={weekStart}
                onChange={(event) => {
                  if (event.target.value) {
                    setWeekStart(mondayOf(event.target.value));
                  }
                }}
                className="bg-transparent outline-none"
                aria-label="跳到指定週"
              />
            </label>
          </div>
        </div>

        <div className="flex border-b border-gray-200">
          {subjects.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => setSubject(item.key)}
              className={
                subject === item.key
                  ? "border-b-2 border-blue-600 px-4 py-2 text-sm font-semibold text-blue-700"
                  : "border-b-2 border-transparent px-4 py-2 text-sm text-gray-500 hover:text-gray-900"
              }
            >
              {item.label}
            </button>
          ))}
        </div>
      </header>

      {error ? (
        <div className="shrink-0 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      ) : null}
      {loading ? <p className="text-sm text-gray-400">載入中…</p> : null}

      {!loading && week ? (
        <div className="grid min-h-0 min-w-0 flex-1 grid-cols-5 gap-2">
          {week.days.map((day) => (
            <CoursePlanDayCard
              key={`${subject}:${day.date}`}
              day={day}
              subject={subject}
              books={subjectBooks}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function CoursePlanDayCard({
  day,
  subject,
  books,
}: {
  day: PlanDay;
  subject: Subject;
  books: HomeworkBook[];
}) {
  const [draft, setDraft] = useState(day);
  const [dirty, setDirty] = useState(false);
  const [saveState, setSaveState] = useState<
    "idle" | "saving" | "saved" | "error"
  >("idle");
  const [error, setError] = useState<string | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [selectedBookId, setSelectedBookId] = useState(books[0]?.id ?? "");
  const [pageLabel, setPageLabel] = useState("");
  const [note, setNote] = useState("");
  const revisionRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setDraft(day);
    setDirty(false);
    setSaveState("idle");
    setError(null);
    revisionRef.current = 0;
  }, [day]);

  useEffect(() => {
    if (!selectedBookId && books[0]) setSelectedBookId(books[0].id);
  }, [books, selectedBookId]);

  const persist = useCallback(async (current: PlanDay) => {
    const response = await fetch("/api/course-plans", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        date: current.date,
        subject,
        unit: current.unit,
        plannedContent: current.plannedContent,
        assignments: current.assignments.map((item) => ({
          id: item.id.startsWith("temp-") ? undefined : item.id,
          bookId: item.bookId,
          pageLabel: item.pageLabel,
          note: item.note,
        })),
      }),
    });
    const json = (await response.json()) as {
      data?: PlanDay;
      error?: string;
    };
    if (!response.ok || !json.data) {
      throw new Error(json.error ?? "儲存失敗");
    }
    return json.data;
  }, [subject]);

  useEffect(() => {
    if (!draft.editable || !dirty || publishing) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    const revision = revisionRef.current;
    timerRef.current = setTimeout(() => {
      setSaveState("saving");
      setError(null);
      void persist(draft)
        .then((saved) => {
          if (revisionRef.current !== revision) return;
          setDraft(saved);
          setDirty(false);
          setSaveState("saved");
        })
        .catch((err: unknown) => {
          if (revisionRef.current !== revision) return;
          setSaveState("error");
          setError(err instanceof Error ? err.message : "儲存失敗");
        });
    }, 700);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [dirty, draft, persist, publishing]);

  function updateDraft(updater: (current: PlanDay) => PlanDay) {
    revisionRef.current += 1;
    setDraft(updater);
    setDirty(true);
    setSaveState("idle");
    setError(null);
  }

  function saveImmediately() {
    if (!draft.editable || !dirty || publishing) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    const revision = revisionRef.current;
    setSaveState("saving");
    setError(null);
    void persist(draft)
      .then((saved) => {
        if (revisionRef.current !== revision) return;
        setDraft(saved);
        setDirty(false);
        setSaveState("saved");
      })
      .catch((err: unknown) => {
        if (revisionRef.current !== revision) return;
        setSaveState("error");
        setError(err instanceof Error ? err.message : "儲存失敗");
      });
  }

  function addAssignment() {
    const book = books.find((item) => item.id === selectedBookId);
    const cleanedPage = pageLabel.trim();
    if (!book || !cleanedPage) return;
    if (
      draft.assignments.some(
        (item) =>
          item.bookId === book.id && item.pageLabel === cleanedPage,
      )
    ) {
      setError("同一簿本與頁數不可重複");
      return;
    }
    updateDraft((current) => ({
      ...current,
      assignments: [
        ...current.assignments,
        {
          id: `temp-${crypto.randomUUID()}`,
          bookId: book.id,
          bookName: book.name,
          pageLabel: cleanedPage,
          note: note.trim(),
          publishedHomeworkId: null,
          publishStatus: "unpublished",
        },
      ],
    }));
    setPageLabel("");
    setNote("");
  }

  function removeAssignment(item: PlanAssignment) {
    if (
      item.publishStatus !== "unpublished" &&
      !window.confirm(
        "這筆作業已發布。從計劃移除不會刪除聯絡簿中的正式作業，仍要移除嗎？",
      )
    ) {
      return;
    }
    updateDraft((current) => ({
      ...current,
      assignments: current.assignments.filter(
        (candidate) => candidate.id !== item.id,
      ),
    }));
  }

  function updateAssignment(
    id: string,
    patch: Partial<Pick<PlanAssignment, "bookId" | "bookName" | "pageLabel" | "note">>,
  ) {
    updateDraft((current) => ({
      ...current,
      assignments: current.assignments.map((item) =>
        item.id === id ? { ...item, ...patch } : item,
      ),
    }));
  }

  async function publish() {
    if (timerRef.current) clearTimeout(timerRef.current);
    setPublishing(true);
    setError(null);
    try {
      let saved = draft;
      if (dirty) {
        setSaveState("saving");
        saved = await persist(draft);
        setDraft(saved);
        setDirty(false);
        setSaveState("saved");
      }
      const response = await fetch("/api/course-plans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "publish",
          date: saved.date,
          subject,
        }),
      });
      const json = (await response.json()) as {
        data?: { day: PlanDay; dueDate: string };
        error?: string;
      };
      if (!response.ok || !json.data) {
        throw new Error(json.error ?? "發布失敗");
      }
      setDraft(json.data.day);
      setSaveState("saved");
    } catch (err) {
      setError(err instanceof Error ? err.message : "發布失敗");
    } finally {
      setPublishing(false);
    }
  }

  const needsPublish = draft.assignments.some(
    (item) => item.publishStatus !== "published",
  );
  const hasOutdated = draft.assignments.some(
    (item) => item.publishStatus === "outdated",
  );
  const lockedReason = draft.isHoliday
    ? "假日不可輸入"
    : !draft.hasClass
      ? subject === "math"
        ? "本日無數學課"
        : "本日無國語課"
      : !draft.inTerm
        ? "不在學期範圍"
        : "舊學期僅供查看";

  return (
    <Card
      className={
        draft.editable
          ? "flex h-full min-h-0 min-w-0 flex-col p-3"
          : "flex h-full min-h-0 min-w-0 flex-col bg-gray-50 p-3"
      }
    >
      <div className="flex shrink-0 items-start justify-between gap-1 border-b border-gray-100 pb-2">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-gray-900">
            {dayTitle(draft.date)}
          </h2>
          <p className="mt-0.5 truncate text-[11px] text-gray-500">
            {draft.calendarTitles.join("、") ||
              draft.termName ||
              "未設定學期"}
          </p>
        </div>
        {!draft.editable ? (
          <span className="shrink-0 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-800">
            {lockedReason}
          </span>
        ) : null}
      </div>

      <div className="mt-2 shrink-0 space-y-2">
        <label className="block text-[11px] font-medium text-gray-600">
          單元
          <input
            type="text"
            value={draft.unit}
            disabled={!draft.editable}
            onBlur={saveImmediately}
            onChange={(event) =>
              updateDraft((current) => ({
                ...current,
                unit: event.target.value,
              }))
            }
            placeholder="例：第六課"
            className="mt-1 h-8 w-full rounded-md border border-gray-200 bg-white px-2 text-sm outline-none ring-blue-500 focus:ring-2 disabled:bg-gray-100"
          />
        </label>
        <label className="block text-[11px] font-medium text-gray-600">
          教學內容
          <textarea
            value={draft.plannedContent}
            disabled={!draft.editable}
            onBlur={saveImmediately}
            onChange={(event) =>
              updateDraft((current) => ({
                ...current,
                plannedContent: event.target.value,
              }))
            }
            placeholder="今天預計教到哪裡？"
            rows={2}
            className="mt-1 max-h-20 w-full resize-none overflow-y-auto rounded-md border border-gray-200 bg-white px-2 py-1.5 text-sm outline-none ring-blue-500 focus:ring-2 disabled:bg-gray-100"
          />
        </label>
      </div>

      <div className="mt-2 flex min-h-0 flex-1 flex-col border-t border-gray-100 pt-2">
        <h3 className="shrink-0 text-[11px] font-semibold text-gray-700">
          作業
        </h3>
        {draft.editable ? (
          <div className="mt-1 shrink-0 space-y-1">
            <div className="flex gap-1">
              <select
                value={selectedBookId}
                onChange={(event) => setSelectedBookId(event.target.value)}
                className="h-7 min-w-0 flex-1 rounded-md border border-gray-200 bg-white px-1 text-xs"
              >
                <option value="">簿本</option>
                {books.map((book) => (
                  <option key={book.id} value={book.id}>
                    {book.name}
                  </option>
                ))}
              </select>
              <input
                type="text"
                value={pageLabel}
                onChange={(event) => setPageLabel(event.target.value)}
                placeholder="頁數"
                className="h-7 w-[4.5rem] rounded-md border border-gray-200 px-1.5 text-xs outline-none ring-blue-500 focus:ring-2"
              />
              <Button
                variant="secondary"
                size="sm"
                className="h-7 px-2"
                disabled={!selectedBookId || !pageLabel.trim()}
                onClick={addAssignment}
              >
                <Plus className="h-3.5 w-3.5" />
              </Button>
            </div>
            <input
              type="text"
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="補充說明（選填）"
              className="h-7 w-full rounded-md border border-gray-200 px-2 text-xs outline-none ring-blue-500 focus:ring-2"
            />
            {books.length === 0 ? (
              <p className="text-[11px] text-amber-700">
                尚無{subjectLabel(subject)}簿本
              </p>
            ) : null}
          </div>
        ) : null}

        <ul className="mt-1 min-h-0 flex-1 space-y-1 overflow-y-auto">
          {draft.assignments.length === 0 ? (
            <li className="text-xs text-gray-400">尚未安排作業</li>
          ) : (
            draft.assignments.map((item) => (
              <li
                key={item.id}
                className="rounded-md border border-gray-200 bg-white p-1.5"
              >
                {draft.editable ? (
                  <div className="space-y-1">
                    <div className="flex items-center gap-1">
                      <select
                        value={item.bookId}
                        onBlur={saveImmediately}
                        onChange={(event) => {
                          const book = books.find(
                            (candidate) => candidate.id === event.target.value,
                          );
                          if (!book) return;
                          updateAssignment(item.id, {
                            bookId: book.id,
                            bookName: book.name,
                          });
                        }}
                        className="h-7 min-w-0 flex-1 rounded-md border border-gray-200 bg-white px-1 text-xs"
                      >
                        {books.map((book) => (
                          <option key={book.id} value={book.id}>
                            {book.name}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => removeAssignment(item)}
                        className="rounded p-1 text-red-500 hover:bg-red-50"
                        aria-label="移除作業"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <input
                      type="text"
                      value={item.pageLabel}
                      onBlur={saveImmediately}
                      onChange={(event) =>
                        updateAssignment(item.id, {
                          pageLabel: event.target.value,
                        })
                      }
                      placeholder="頁數／範圍"
                      className="h-7 w-full rounded-md border border-gray-200 px-2 text-xs outline-none ring-blue-500 focus:ring-2"
                    />
                    <input
                      type="text"
                      value={item.note}
                      onBlur={saveImmediately}
                      onChange={(event) =>
                        updateAssignment(item.id, { note: event.target.value })
                      }
                      placeholder="補充說明（選填）"
                      className="h-7 w-full rounded-md border border-gray-200 px-2 text-xs outline-none ring-blue-500 focus:ring-2"
                    />
                  </div>
                ) : (
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-gray-800">
                      {item.bookName} {item.pageLabel}
                    </p>
                    {item.note ? (
                      <p className="mt-0.5 text-[11px] text-gray-500">
                        {item.note}
                      </p>
                    ) : null}
                  </div>
                )}
                <PublishBadge status={item.publishStatus} />
              </li>
            ))
          )}
        </ul>
      </div>

      <div className="mt-2 shrink-0 border-t border-gray-100 pt-2">
        {error ? (
          <div className="mb-1 flex items-center justify-between gap-1 text-[11px] text-red-600">
            <span>{error}</span>
            {saveState === "error" ? (
              <button
                type="button"
                className="font-medium underline"
                onClick={() => {
                  revisionRef.current += 1;
                  setDraft((current) => ({ ...current }));
                  setSaveState("idle");
                }}
              >
                重試
              </button>
            ) : null}
          </div>
        ) : null}
        {draft.editable ? (
          <>
            <p className="mb-1 text-[11px] text-gray-400">
              {saveState === "saving"
                ? "儲存中…"
                : saveState === "saved"
                  ? "已自動儲存"
                  : saveState === "error"
                    ? "儲存失敗"
                    : dirty
                      ? "等待自動儲存…"
                      : "輸入後會自動儲存"}
            </p>
            <Button
              className="h-8 w-full text-xs"
              disabled={
                publishing ||
                draft.assignments.length === 0 ||
                (!needsPublish && !dirty)
              }
              onClick={() => void publish()}
            >
              <Send className="h-3.5 w-3.5" />
              {publishing
                ? "處理中…"
                : draft.assignments.length === 0
                  ? "尚無作業"
                  : hasOutdated
                    ? "更新聯絡簿"
                    : needsPublish
                      ? "發布到聯絡簿"
                      : "已發布"}
            </Button>
          </>
        ) : null}
      </div>
    </Card>
  );
}

function PublishBadge({ status }: { status: PublishStatus }) {
  const styles = {
    unpublished: "bg-gray-100 text-gray-600",
    published: "bg-green-100 text-green-700",
    outdated: "bg-amber-100 text-amber-800",
  };
  const labels = {
    unpublished: "尚未發布",
    published: "已發布",
    outdated: "內容已變更",
  };
  return (
    <span
      className={`mt-1 inline-flex rounded-full px-1.5 py-0.5 text-[10px] font-medium ${styles[status]}`}
    >
      {labels[status]}
    </span>
  );
}
