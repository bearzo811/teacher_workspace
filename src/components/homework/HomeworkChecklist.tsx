"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export type HomeworkChecklistItem = {
  id: string;
  title: string;
};

export type HomeworkChecklistStudent = {
  studentId: string;
  name: string;
  seatNumber: number;
  cells: {
    homeworkId: string;
    title: string;
    completed: boolean;
    status: "unsubmitted" | "pending_confirmation" | "correction_required" | "completed";
  }[];
};

type HomeworkChecklistProps = {
  items: HomeworkChecklistItem[];
  students: HomeworkChecklistStudent[];
  busyKey?: string | null;
  onToggle: (
    studentId: string,
    homeworkId: string,
    nextCompleted: boolean,
  ) => void;
  onSetStatus?: (
    studentId: string,
    homeworkId: string,
    status: "unsubmitted" | "pending_confirmation" | "correction_required" | "completed",
  ) => void;
  onBatchSetStatus?: (
    studentIds: string[],
    status: "correction_required" | "completed",
  ) => void;
  onDeleteItem?: (homeworkId: string) => void;
};

export function HomeworkChecklist({
  items,
  students,
  busyKey,
  onToggle,
  onSetStatus,
  onBatchSetStatus,
  onDeleteItem,
}: HomeworkChecklistProps) {
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  if (items.length === 0) {
    return (
      <Card>
        <CardTitle>今日作業表</CardTitle>
        <CardDescription>先建立作業後再打勾</CardDescription>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden p-0">
      <div className="border-b border-gray-100 px-5 py-4">
        <CardTitle>今日作業表</CardTitle>
        <CardDescription>可快速點格完成，也可用下拉選單管理四種作業狀態</CardDescription>
        {onDeleteItem ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {items.map((item) => (
              <div
                key={item.id}
                className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-2 py-1 text-xs text-gray-600"
              >
                {item.title}
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-1 text-red-600"
                  onClick={() => onDeleteItem(item.id)}
                >
                  刪
                </Button>
              </div>
            ))}
          </div>
        ) : null}
        {onBatchSetStatus && selectedStudentIds.length > 0 ? (
          <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
            <span className="text-gray-600">已選 {selectedStudentIds.length} 位</span>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => onBatchSetStatus(selectedStudentIds, "completed")}
            >
              批次改已完成
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => onBatchSetStatus(selectedStudentIds, "correction_required")}
            >
              批次改未訂正
            </Button>
          </div>
        ) : null}
      </div>

      <div className="overflow-auto">
        <table className="min-w-full border-collapse text-center text-sm">
          <thead>
            <tr className="bg-gray-50">
              <th className="sticky left-0 z-10 border-b border-r border-gray-200 bg-gray-50 px-3 py-2 font-medium text-gray-600">
                <input
                  aria-label="全選學生"
                  type="checkbox"
                  checked={students.length > 0 && selectedStudentIds.length === students.length}
                  onChange={(event) =>
                    setSelectedStudentIds(event.target.checked ? students.map((student) => student.studentId) : [])
                  }
                />
              </th>
              <th className="sticky left-16 z-10 border-b border-r border-gray-200 bg-gray-50 px-3 py-2 font-medium text-gray-600">
                姓名
              </th>
              {items.map((item) => (
                <th
                  key={item.id}
                  className="border-b border-gray-200 px-2 py-2 font-medium text-gray-600"
                >
                  {item.title}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {students.map((student) => (
              <tr key={student.studentId} className="hover:bg-gray-50/80">
                <td className="sticky left-0 z-10 border-b border-r border-gray-100 bg-white px-3 py-1 text-gray-500">
                  <label className="flex items-center justify-center gap-1">
                    <input
                      aria-label={`選取${student.name}`}
                      type="checkbox"
                      checked={selectedStudentIds.includes(student.studentId)}
                      onChange={(event) =>
                        setSelectedStudentIds((current) =>
                          event.target.checked
                            ? [...new Set([...current, student.studentId])]
                            : current.filter((id) => id !== student.studentId),
                        )
                      }
                    />
                    {student.seatNumber}
                  </label>
                </td>
                <td className="sticky left-16 z-10 border-b border-r border-gray-100 bg-white px-3 py-1 font-medium text-gray-900 whitespace-nowrap">
                  {student.name}
                </td>
                {student.cells.map((cell) => {
                  const key = `${student.studentId}:${cell.homeworkId}`;
                  const busy = busyKey === key;
                  return (
                    <td key={key} className="border-b border-gray-100 p-1">
                      <button
                        type="button"
                        disabled={busy}
                        title={`${student.name}｜${cell.title}`}
                        onClick={() =>
                          onToggle(
                            student.studentId,
                            cell.homeworkId,
                            !cell.completed,
                          )
                        }
                        className="mx-auto flex h-8 w-full items-center justify-center rounded hover:bg-gray-100 disabled:opacity-50"
                      >
                        <span
                          className={cn(
                            "flex h-5 w-5 items-center justify-center rounded border text-xs",
                            cell.completed
                              ? "border-green-600 bg-green-600 text-white"
                              : "border-gray-300 bg-white text-transparent",
                          )}
                        >
                          ✓
                        </span>
                      </button>
                      {onSetStatus ? (
                        <select
                          aria-label={`${student.name} ${cell.title} 狀態`}
                          disabled={busy}
                          value={cell.status}
                          onChange={(event) =>
                            onSetStatus(
                              student.studentId,
                              cell.homeworkId,
                              event.target.value as typeof cell.status,
                            )
                          }
                          className="mt-1 h-7 w-full rounded border border-gray-200 bg-white px-1 text-[11px] text-gray-700 disabled:opacity-50"
                        >
                          <option value="unsubmitted">未交</option>
                          <option value="pending_confirmation">待確認</option>
                          <option value="correction_required">未訂正</option>
                          <option value="completed">已完成</option>
                        </select>
                      ) : null}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
