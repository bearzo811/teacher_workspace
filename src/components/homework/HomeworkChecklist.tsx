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
  cells: { homeworkId: string; title: string; completed: boolean }[];
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
  onDeleteItem?: (homeworkId: string) => void;
};

export function HomeworkChecklist({
  items,
  students,
  busyKey,
  onToggle,
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
        <CardDescription>點格子切換完成／未完成</CardDescription>
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
        <table className="min-w-full border-collapse text-center text-sm">
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
                  {student.seatNumber}
                </td>
                <td className="sticky left-16 z-10 border-b border-r border-gray-100 bg-white px-3 py-1 font-medium text-gray-900 whitespace-nowrap">
                  {student.name}
                </td>
                {student.cells.map((cell) => {
                  const key = `${student.studentId}:${cell.homeworkId}`;
                  const busy = busyKey === key;
                  return (
                    <td key={key} className="border-b border-gray-100 p-0">
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
                        className="flex h-10 w-full items-center justify-center hover:bg-gray-100 disabled:opacity-50"
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
