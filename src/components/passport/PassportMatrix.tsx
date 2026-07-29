"use client";

import { cn } from "@/lib/utils";

export type MatrixStudent = {
  studentId: string;
  name: string;
  seatNumber: number;
  cells: { week: number; completed: boolean }[];
  completedCount: number;
};

type PassportMatrixProps = {
  weeks: number[];
  currentWeek: number;
  weekTotals: { week: number; completed: number; total: number }[];
  students: MatrixStudent[];
  busyKey?: string | null;
  onToggle: (studentId: string, week: number, nextCompleted: boolean) => void;
  onSetCurrentWeek?: (week: number) => void;
};

export function PassportMatrix({
  weeks,
  currentWeek,
  weekTotals,
  students,
  busyKey,
  onToggle,
  onSetCurrentWeek,
}: PassportMatrixProps) {
  if (students.length === 0) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-5 text-sm text-gray-500">
        尚無在籍學生。請先到「學生中心」新增。
      </div>
    );
  }

  return (
    <div className="overflow-auto rounded-xl border border-gray-200 bg-white shadow-sm">
      <table className="min-w-full border-collapse text-sm">
        <thead>
          <tr className="bg-gray-50">
            <th className="sticky left-0 z-20 w-12 min-w-12 border-b border-r border-gray-200 bg-gray-50 px-2 py-2 text-left font-medium text-gray-600">
              座
            </th>
            <th className="sticky left-12 z-20 w-24 min-w-24 border-b border-r border-gray-200 bg-gray-50 px-2 py-2 text-left font-medium text-gray-600">
              姓名
            </th>
            {weeks.map((week) => {
              const total = weekTotals.find((item) => item.week === week);
              const isCurrent = week === currentWeek;
              return (
                <th
                  key={week}
                  className={cn(
                    "border-b border-gray-200 px-0.5 py-1 text-center font-medium",
                    isCurrent ? "bg-blue-50 text-blue-700" : "text-gray-600",
                  )}
                >
                  <button
                    type="button"
                    title={`設第 ${week} 週為目前週`}
                    onClick={() => onSetCurrentWeek?.(week)}
                    className="w-full rounded px-1 py-1 hover:bg-blue-100/70"
                  >
                    <div className="text-xs">W{week}</div>
                    {total ? (
                      <div className="text-[10px] font-normal text-gray-500">
                        {total.completed}/{total.total}
                      </div>
                    ) : null}
                  </button>
                </th>
              );
            })}
            <th className="border-b border-l border-gray-200 px-2 py-2 text-center font-medium text-gray-600">
              合計
            </th>
          </tr>
        </thead>
        <tbody>
          {students.map((student) => (
            <tr key={student.studentId} className="hover:bg-gray-50/80">
              <td className="sticky left-0 z-10 w-12 min-w-12 border-b border-r border-gray-100 bg-white px-2 py-1 text-center text-gray-500">
                {student.seatNumber}
              </td>
              <td className="sticky left-12 z-10 w-24 min-w-24 border-b border-r border-gray-100 bg-white px-2 py-1 font-medium text-gray-900 whitespace-nowrap">
                {student.name}
              </td>
              {student.cells.map((cell) => {
                const key = `${student.studentId}:${cell.week}`;
                const busy = busyKey === key;
                const isCurrent = cell.week === currentWeek;
                return (
                  <td
                    key={key}
                    className={cn(
                      "border-b border-gray-100 p-0 text-center",
                      isCurrent && "bg-blue-50/60",
                    )}
                  >
                    <button
                      type="button"
                      disabled={busy}
                      title={`第 ${cell.week} 週｜${student.name}`}
                      onClick={() =>
                        onToggle(student.studentId, cell.week, !cell.completed)
                      }
                      className={cn(
                        "flex h-9 w-9 items-center justify-center transition-colors disabled:opacity-50",
                        cell.completed
                          ? "text-green-600 hover:bg-green-50"
                          : "text-gray-300 hover:bg-gray-100 hover:text-gray-400",
                      )}
                    >
                      <span
                        className={cn(
                          "flex h-5 w-5 items-center justify-center rounded border text-xs",
                          cell.completed
                            ? "border-green-600 bg-green-600 text-white"
                            : "border-gray-300 bg-white",
                        )}
                      >
                        {cell.completed ? "✓" : ""}
                      </span>
                    </button>
                  </td>
                );
              })}
              <td className="border-b border-l border-gray-100 px-2 py-1 text-center text-gray-600">
                {student.completedCount}/{weeks.length}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
