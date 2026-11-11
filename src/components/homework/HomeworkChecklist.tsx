"use client";

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
  onDeleteItem?: (homeworkId: string) => void;
};

export function HomeworkChecklist({
  items,
  students,
  busyKey,
  onToggle,
  onSetStatus,
  onDeleteItem,
}: HomeworkChecklistProps) {
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
      </div>

      <div className="overflow-auto">
        <table
          className="w-full table-fixed border-collapse text-center text-sm"
          style={{ minWidth: `${10 + items.length * 8}rem` }}
        >
          <colgroup>
            <col style={{ width: "4rem" }} />
            <col style={{ width: "6rem" }} />
            {items.map((item) => <col key={item.id} />)}
          </colgroup>
          <thead>
            <tr className="bg-gray-50">
              <th className="sticky left-0 z-10 border-b border-r border-gray-200 bg-gray-50 px-3 py-2 font-medium text-gray-600">
                座號
              </th>
              <th className="sticky left-16 z-10 border-b border-r border-gray-200 bg-gray-50 px-3 py-2 font-medium text-gray-600">
                姓名
              </th>
              {items.map((item) => (
                <th
                  key={item.id}
                  className="break-words border-b border-gray-200 px-2 py-2 font-medium text-gray-600"
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
                  {student.seatNumber}
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
