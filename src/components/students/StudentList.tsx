"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export type StudentListItem = {
  id: string;
  name: string;
  seatNumber: number;
};

type StudentListProps = {
  students: StudentListItem[];
  onEdit: (student: StudentListItem) => void;
  onDelete: (student: StudentListItem) => void;
  busyId?: string | null;
};

export function StudentList({
  students,
  onEdit,
  onDelete,
  busyId,
}: StudentListProps) {
  if (students.length === 0) {
    return (
      <Card>
        <p className="text-sm text-gray-500">目前沒有學生，先新增一位吧。</p>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden p-0">
      <ul className="divide-y divide-gray-100">
        {students.map((student) => {
          const busy = busyId === student.id;
          return (
            <li
              key={student.id}
              className="flex items-center justify-between gap-3 px-5 py-3"
            >
              <Link
                href={`/students/${student.id}`}
                className="min-w-0 flex-1 rounded-lg px-1 py-1 hover:bg-gray-50"
              >
                <p className="text-sm font-medium text-gray-900">
                  <span className="mr-2 inline-block w-8 text-center text-gray-500">
                    {student.seatNumber}
                  </span>
                  {student.name}
                </p>
              </Link>
              <div className="flex shrink-0 gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={busy}
                  onClick={() => onEdit(student)}
                >
                  編輯
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={busy}
                  onClick={() => onDelete(student)}
                >
                  轉出
                </Button>
              </div>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
