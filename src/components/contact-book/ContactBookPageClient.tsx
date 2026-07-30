"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import {
  formatDisplayDate,
  nextSchoolDay,
  todayDateString,
} from "@/lib/dates";
import { formatHomeworkTitle } from "@/types/homework";

type HomeworkBook = {
  id: string;
  name: string;
  sortOrder: number;
  isActive: boolean;
};

type AssignmentDraft = {
  bookId: string;
  bookName: string;
  pageLabel: string;
  title: string;
};

type ContactBookData = {
  date: string;
  dueDate: string;
  notes: string[];
  titles: string[];
  assignments: AssignmentDraft[];
  className: string;
  schoolYear: string;
};

export function ContactBookPageClient() {
  const [date, setDate] = useState(todayDateString);
  const [assignments, setAssignments] = useState<AssignmentDraft[]>([]);
  const [notes, setNotes] = useState<string[]>([]);
  const [books, setBooks] = useState<HomeworkBook[]>([]);
  const [dueDate, setDueDate] = useState(() => nextSchoolDay(todayDateString()));
  const [selectedBookId, setSelectedBookId] = useState<string>("");
  const [pageLabel, setPageLabel] = useState("");
  const [customNote, setCustomNote] = useState("");
  const [newBookName, setNewBookName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [composing, setComposing] = useState(false);
  const [displayContactBookDate, setDisplayContactBookDate] = useState("");
  const [settingDisplay, setSettingDisplay] = useState(false);
  const [showCreateBook, setShowCreateBook] = useState(false);

  const loadDisplayDate = useCallback(async () => {
    const response = await fetch("/api/settings");
    const json = (await response.json()) as {
      data?: {
        displayContactBookDate?: string;
      };
      error?: string;
    };
    if (!response.ok) {
      throw new Error(json.error ?? "讀取大屏設定失敗");
    }
    setDisplayContactBookDate(json.data?.displayContactBookDate?.trim() ?? "");
  }, []);

  const loadBooks = useCallback(async () => {
    const response = await fetch("/api/homework-books?activeOnly=1");
    const json = (await response.json()) as {
      data?: HomeworkBook[];
      error?: string;
    };
    if (!response.ok) throw new Error(json.error ?? "讀取簿本失敗");
    const list = json.data ?? [];
    setBooks(list);
    setSelectedBookId((prev) => prev || list[0]?.id || "");
  }, []);

  const load = useCallback(
    async (selectedDate: string) => {
      setLoading(true);
      setError(null);
      setMessage(null);
      try {
        const [response] = await Promise.all([
          fetch(`/api/contact-book?date=${encodeURIComponent(selectedDate)}`),
          loadDisplayDate(),
          loadBooks(),
        ]);
        const json = (await response.json()) as {
          data?: ContactBookData;
          error?: string;
        };
        if (!response.ok) {
          throw new Error(json.error ?? "讀取失敗");
        }
        const data = json.data!;
        setAssignments(data.assignments ?? []);
        setNotes(data.notes ?? []);
        setDueDate(data.dueDate);
      } catch (err) {
        setError(err instanceof Error ? err.message : "讀取失敗");
      } finally {
        setLoading(false);
      }
    },
    [loadBooks, loadDisplayDate],
  );

  useEffect(() => {
    void load(date);
  }, [date, load]);

  const previewDueDate = dueDate || nextSchoolDay(date);
  const isDisplayDate = displayContactBookDate === date;
  const displayFollowsToday = displayContactBookDate === "";

  const selectedBook = useMemo(
    () => books.find((book) => book.id === selectedBookId) ?? null,
    [books, selectedBookId],
  );

  function addAssignment() {
    if (!selectedBook) return;
    const cleaned = pageLabel.trim();
    if (!cleaned) return;
    const title = formatHomeworkTitle(selectedBook.name, cleaned);
    if (
      assignments.some(
        (item) =>
          item.bookId === selectedBook.id && item.pageLabel === cleaned,
      )
    ) {
      return;
    }
    setAssignments((prev) => [
      ...prev,
      {
        bookId: selectedBook.id,
        bookName: selectedBook.name,
        pageLabel: cleaned,
        title,
      },
    ]);
    setPageLabel("");
  }

  function removeAssignment(bookId: string, label: string) {
    setAssignments((prev) =>
      prev.filter(
        (item) => !(item.bookId === bookId && item.pageLabel === label),
      ),
    );
  }

  function addNote(text: string) {
    const cleaned = text.trim();
    if (!cleaned || notes.includes(cleaned)) return;
    setNotes((prev) => [...prev, cleaned]);
  }

  function removeNote(text: string) {
    setNotes((prev) => prev.filter((item) => item !== text));
  }

  async function handleCreateBook() {
    const name = newBookName.trim();
    if (!name) return;
    setError(null);
    try {
      const response = await fetch("/api/homework-books", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const json = (await response.json()) as {
        data?: HomeworkBook;
        error?: string;
      };
      if (!response.ok) throw new Error(json.error ?? "新增簿本失敗");
      setNewBookName("");
      await loadBooks();
      if (json.data?.id) setSelectedBookId(json.data.id);
      setShowCreateBook(false);
      setMessage(`已新增簿本「${json.data?.name ?? name}」`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "新增簿本失敗");
    }
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch("/api/contact-book", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date,
          notes,
          assignments: assignments.map((item) => ({
            bookId: item.bookId,
            pageLabel: item.pageLabel,
          })),
        }),
      });
      const json = (await response.json()) as {
        data?: ContactBookData;
        error?: string;
      };
      if (!response.ok) {
        throw new Error(json.error ?? "儲存失敗");
      }
      setAssignments(json.data!.assignments ?? []);
      setNotes(json.data!.notes ?? []);
      setDueDate(json.data!.dueDate);
      setMessage(
        `已儲存；作業將於繳交日 ${formatDisplayDate(json.data!.dueDate)} 出現在作業管理`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "儲存失敗");
    } finally {
      setSaving(false);
    }
  }

  async function setDisplayDate(next: string) {
    setSettingDisplay(true);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayContactBookDate: next }),
      });
      const json = (await response.json()) as {
        data?: { displayContactBookDate?: string };
        error?: string;
      };
      if (!response.ok) {
        throw new Error(json.error ?? "更新大屏顯示日失敗");
      }
      setDisplayContactBookDate(json.data?.displayContactBookDate?.trim() ?? next);
      setMessage(
        next
          ? `大屏聯絡簿已設為 ${formatDisplayDate(next)}`
          : "大屏聯絡簿已改回跟系統今天",
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "更新大屏顯示日失敗");
    } finally {
      setSettingDisplay(false);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">聯絡簿</h1>
          <p className="mt-1 text-sm text-gray-500">
            作業＝簿本＋頁數；會同步到下一個上課日的作業繳交表
          </p>
        </div>
        <div className="flex flex-col items-start gap-1 sm:items-end">
          <label className="text-sm text-gray-600">
            聯絡簿日期
            <input
              type="date"
              value={date}
              onChange={(event) => setDate(event.target.value)}
              className="ml-2 h-10 rounded-lg border border-gray-200 px-3 text-sm outline-none ring-blue-500 focus:ring-2"
            />
          </label>
          <p className="text-xs text-amber-700">
            繳交日：{formatDisplayDate(previewDueDate)}
          </p>
          <p className="text-xs text-slate-500">
            大屏目前：
            {displayFollowsToday
              ? "跟系統今天"
              : formatDisplayDate(displayContactBookDate)}
          </p>
        </div>
      </header>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {message ? <p className="text-sm text-green-600">{message}</p> : null}
      {loading ? <p className="text-sm text-gray-400">載入中…</p> : null}

      <div className="flex flex-col gap-4">
        <Card>
          <CardTitle>作業項目</CardTitle>
          <CardDescription>
            選簿本＋填頁數（例：12-15、12,14、第3課）；會進作業打勾表
          </CardDescription>

          <div className="mt-4 flex flex-wrap gap-2">
            {books.map((book) => (
              <button
                key={book.id}
                type="button"
                onClick={() => setSelectedBookId(book.id)}
                className={
                  selectedBookId === book.id
                    ? "rounded-lg border border-blue-500 bg-blue-50 px-3 py-1.5 text-sm font-medium text-blue-700"
                    : "rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
                }
              >
                {book.name}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setShowCreateBook((current) => !current)}
              className="rounded-lg border border-dashed border-blue-300 bg-white px-3 py-1.5 text-sm font-medium text-blue-700 hover:bg-blue-50"
            >
              ＋新增簿本
            </button>
          </div>

          <div className="mt-3 flex gap-2">
            <input
              type="text"
              value={pageLabel}
              onChange={(event) => setPageLabel(event.target.value)}
              placeholder="頁數／課次，例：12-15"
              className="h-10 flex-1 rounded-lg border border-gray-200 px-3 text-sm outline-none ring-blue-500 focus:ring-2"
              onCompositionStart={() => setComposing(true)}
              onCompositionEnd={() => setComposing(false)}
              onKeyDown={(event) => {
                if (event.nativeEvent.isComposing || composing) return;
                if (event.key === "Enter") {
                  event.preventDefault();
                  addAssignment();
                }
              }}
            />
            <Button
              variant="secondary"
              disabled={!selectedBookId || !pageLabel.trim()}
              onClick={addAssignment}
            >
              加入
            </Button>
          </div>

          {showCreateBook ? (
            <div className="mt-3 flex gap-2 rounded-lg border border-blue-100 bg-blue-50/50 p-3">
              <input
                type="text"
                value={newBookName}
                onChange={(event) => setNewBookName(event.target.value)}
                placeholder="新簿本名稱"
                autoFocus
                className="h-10 flex-1 rounded-lg border border-gray-200 bg-white px-3 text-sm outline-none ring-blue-500 focus:ring-2"
                onCompositionStart={() => setComposing(true)}
                onCompositionEnd={() => setComposing(false)}
                onKeyDown={(event) => {
                  if (event.nativeEvent.isComposing || composing) return;
                  if (event.key === "Enter") {
                    event.preventDefault();
                    void handleCreateBook();
                  }
                  if (event.key === "Escape") {
                    setNewBookName("");
                    setShowCreateBook(false);
                  }
                }}
              />
              <Button
                variant="secondary"
                disabled={!newBookName.trim()}
                onClick={() => {
                  void handleCreateBook();
                }}
              >
                確認新增
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  setNewBookName("");
                  setShowCreateBook(false);
                }}
              >
                取消
              </Button>
            </div>
          ) : null}

          <ul className="mt-4 space-y-2">
            {assignments.length === 0 ? (
              <li className="text-sm text-gray-400">尚未加入項目</li>
            ) : (
              assignments.map((item) => (
                <li
                  key={`${item.bookId}:${item.pageLabel}`}
                  className="flex items-center justify-between rounded-lg border border-gray-100 px-3 py-2 text-sm"
                >
                  <span>{item.title}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-red-600"
                    onClick={() =>
                      removeAssignment(item.bookId, item.pageLabel)
                    }
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
          <CardDescription>
            一項一項加；只顯示在聯絡簿／大屏，不進作業打勾表
          </CardDescription>

          <div className="mt-3 flex gap-2">
            <input
              type="text"
              value={customNote}
              onChange={(event) => setCustomNote(event.target.value)}
              placeholder="例如：明天帶美勞用具"
              className="h-10 flex-1 rounded-lg border border-gray-200 px-3 text-sm outline-none ring-blue-500 focus:ring-2"
              onCompositionStart={() => setComposing(true)}
              onCompositionEnd={() => setComposing(false)}
              onKeyDown={(event) => {
                if (event.nativeEvent.isComposing || composing) return;
                if (event.key === "Enter") {
                  event.preventDefault();
                  addNote(customNote);
                  setCustomNote("");
                }
              }}
            />
            <Button
              variant="secondary"
              onClick={() => {
                addNote(customNote);
                setCustomNote("");
              }}
            >
              加入
            </Button>
          </div>

          <ul className="mt-4 space-y-2">
            {notes.length === 0 ? (
              <li className="text-sm text-gray-400">尚未加入叮嚀</li>
            ) : (
              notes.map((text) => (
                <li
                  key={text}
                  className="flex items-center justify-between rounded-lg border border-gray-100 px-3 py-2 text-sm"
                >
                  <span>{text}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-red-600"
                    onClick={() => removeNote(text)}
                  >
                    移除
                  </Button>
                </li>
              ))
            )}
          </ul>
        </Card>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            disabled={loading || saving}
            onClick={() => {
              void handleSave();
            }}
          >
            {saving ? "儲存中…" : "儲存並同步作業"}
          </Button>
          <Button
            variant="secondary"
            disabled={loading || settingDisplay || isDisplayDate}
            onClick={() => {
              void setDisplayDate(date);
            }}
          >
            {isDisplayDate
              ? "大屏正顯示此日"
              : settingDisplay
                ? "設定中…"
                : "設為大屏顯示日"}
          </Button>
          {!displayFollowsToday ? (
            <Button
              variant="ghost"
              disabled={loading || settingDisplay}
              onClick={() => {
                void setDisplayDate("");
              }}
            >
              改回跟系統今天
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
