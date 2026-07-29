"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { SearchBar } from "@/components/students/SearchBar";
import {
  StudentFormCard,
  type StudentFormValues,
} from "@/components/students/StudentFormCard";
import {
  StudentList,
  type StudentListItem,
} from "@/components/students/StudentList";

type ApiStudent = {
  id: string;
  name: string;
  seatNumber: number;
};

const emptyForm: StudentFormValues = { name: "", seatNumber: "" };

export function StudentsPageClient() {
  const [students, setStudents] = useState<StudentListItem[]>([]);
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [createForm, setCreateForm] = useState<StudentFormValues>(emptyForm);
  const [editTarget, setEditTarget] = useState<StudentListItem | null>(null);
  const [editForm, setEditForm] = useState<StudentFormValues>(emptyForm);
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query.trim()), 250);
    return () => clearTimeout(timer);
  }, [query]);

  const loadStudents = useCallback(async (q: string) => {
    const params = q ? `?q=${encodeURIComponent(q)}` : "";
    const response = await fetch(`/api/students${params}`);
    const json = (await response.json()) as {
      data?: ApiStudent[];
      error?: string;
    };
    if (!response.ok) {
      throw new Error(json.error ?? "讀取學生失敗");
    }
    setStudents(
      (json.data ?? []).map((student) => ({
        id: student.id,
        name: student.name,
        seatNumber: student.seatNumber,
      })),
    );
  }, []);

  useEffect(() => {
    startTransition(() => {
      void loadStudents(debouncedQuery).catch((err: unknown) => {
        setError(err instanceof Error ? err.message : "讀取學生失敗");
      });
    });
  }, [debouncedQuery, loadStudents]);

  async function handleCreate() {
    setFormError(null);
    const seatNumber = Number(createForm.seatNumber);
    const response = await fetch("/api/students", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: createForm.name,
        seatNumber,
      }),
    });
    const json = (await response.json()) as { error?: string };
    if (!response.ok) {
      setFormError(json.error ?? "新增失敗");
      return;
    }
    setCreateForm(emptyForm);
    await loadStudents(debouncedQuery);
  }

  async function handleUpdate() {
    if (!editTarget) return;
    setFormError(null);
    setBusyId(editTarget.id);
    try {
      const seatNumber = Number(editForm.seatNumber);
      const response = await fetch(`/api/students/${editTarget.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editForm.name,
          seatNumber,
        }),
      });
      const json = (await response.json()) as { error?: string };
      if (!response.ok) {
        setFormError(json.error ?? "更新失敗");
        return;
      }
      setEditTarget(null);
      setEditForm(emptyForm);
      await loadStudents(debouncedQuery);
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete(student: StudentListItem) {
    const ok = window.confirm(
      `確定將「${student.seatNumber} ${student.name}」標示為轉出？\n（軟刪除，歷史紀錄會保留）`,
    );
    if (!ok) return;

    setBusyId(student.id);
    setError(null);
    try {
      const response = await fetch(`/api/students/${student.id}`, {
        method: "DELETE",
      });
      const json = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(json.error ?? "轉出失敗");
        return;
      }
      if (editTarget?.id === student.id) {
        setEditTarget(null);
        setEditForm(emptyForm);
      }
      await loadStudents(debouncedQuery);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">學生中心</h1>
          <p className="mt-1 text-sm text-gray-500">
            在籍 {students.length} 位（依座號排序）
          </p>
        </div>
        <SearchBar value={query} onChange={setQuery} />
      </header>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {pending ? <p className="text-sm text-gray-400">載入中…</p> : null}

      <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
        <StudentList
          students={students}
          busyId={busyId}
          onEdit={(student) => {
            setFormError(null);
            setEditTarget(student);
            setEditForm({
              name: student.name,
              seatNumber: String(student.seatNumber),
            });
          }}
          onDelete={(student) => {
            void handleDelete(student);
          }}
        />

        <div className="flex flex-col gap-4">
          <StudentFormCard
            title="新增學生"
            description="座號不可與在籍學生重複"
            values={createForm}
            submitLabel="新增"
            pending={pending}
            error={editTarget ? null : formError}
            onChange={setCreateForm}
            onSubmit={() => {
              void handleCreate();
            }}
          />

          {editTarget ? (
            <StudentFormCard
              title="編輯學生"
              description={`正在編輯：${editTarget.seatNumber} ${editTarget.name}`}
              values={editForm}
              submitLabel="儲存"
              pending={busyId === editTarget.id}
              error={formError}
              onChange={setEditForm}
              onSubmit={() => {
                void handleUpdate();
              }}
              onCancel={() => {
                setEditTarget(null);
                setEditForm(emptyForm);
                setFormError(null);
              }}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}
