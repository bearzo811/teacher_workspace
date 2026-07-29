"use client";

import { Card } from "@/components/ui/card";

export type ChecklistStudent = {
  studentId: string;
  name: string;
  seatNumber: number;
  completed: boolean;
};

type StudentChecklistProps = {
  students: ChecklistStudent[];
  busyId?: string | null;
  onToggle: (student: ChecklistStudent) => void;
};

export function StudentChecklist({
  students,
  busyId,
  onToggle,
}: StudentChecklistProps) {
  if (students.length === 0) {
    return (
      <Card>
        <p className="text-sm text-gray-500">
          尚無在籍學生。請先到「學生中心」新增。
        </p>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden p-0">
      <ul className="divide-y divide-gray-100">
        {students.map((student) => {
          const busy = busyId === student.studentId;
          return (
            <li key={student.studentId}>
              <button
                type="button"
                disabled={busy}
                onClick={() => onToggle(student)}
                className="flex w-full items-center gap-3 px-5 py-3 text-left hover:bg-gray-50 disabled:opacity-50"
              >
                <span
                  className={`flex h-5 w-5 items-center justify-center rounded border text-xs ${
                    student.completed
                      ? "border-green-600 bg-green-600 text-white"
                      : "border-gray-300 bg-white text-transparent"
                  }`}
                  aria-hidden
                >
                  ✓
                </span>
                <span className="w-8 text-sm text-gray-500">
                  {student.seatNumber}
                </span>
                <span className="text-sm font-medium text-gray-900">
                  {student.name}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
