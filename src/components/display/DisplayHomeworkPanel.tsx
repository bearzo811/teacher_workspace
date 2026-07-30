import { cn } from "@/lib/utils";
import type { HomeworkDayView } from "@/services/homeworkService";

type DisplayHomeworkPanelProps = {
  homework: HomeworkDayView;
  activeStudentId: string | null;
  canToggle: boolean;
  busyKey: string | null;
  onToggle: (
    studentId: string,
    homeworkId: string,
    nextCompleted: boolean,
  ) => void;
};

export function DisplayHomeworkPanel({
  homework,
  activeStudentId,
  canToggle,
  busyKey,
  onToggle,
}: DisplayHomeworkPanelProps) {
  const { items, students, completedStudentCount, totalStudentCount } =
    homework;

  return (
    <section className="flex h-full flex-col rounded-2xl border border-slate-700 bg-slate-900/80 p-4 md:p-6">
      <header className="mb-4 flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-2xl font-semibold md:text-3xl">作業繳交</h2>
          <p className="mt-1 text-base text-slate-400 md:text-lg">
            {homework.date}
          </p>
        </div>
        <p className="text-xl text-emerald-300 md:text-2xl">
          {items.length === 0
            ? "今日無作業"
            : `${completedStudentCount} / ${totalStudentCount} 全交`}
        </p>
      </header>

      {items.length === 0 ? (
        <p className="text-xl text-slate-500">尚無今日繳交項目</p>
      ) : (
        <div className="overflow-auto rounded-xl border border-slate-700">
          <table className="min-w-full border-collapse text-left text-lg md:text-xl">
            <thead className="bg-slate-800 text-slate-200">
              <tr>
                <th className="sticky left-0 z-10 bg-slate-800 px-3 py-3">
                  座號
                </th>
                <th className="px-3 py-3">姓名</th>
                {items.map((item) => (
                  <th key={item.id} className="px-3 py-3 text-center">
                    {item.title}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {students.map((student) => {
                const isActive = activeStudentId === student.studentId;
                const rowInteractive = canToggle && isActive;
                return (
                  <tr
                    key={student.studentId}
                    className={cn(
                      "border-t border-slate-800",
                      isActive && "bg-sky-950/60",
                    )}
                  >
                    <td className="sticky left-0 z-10 bg-inherit px-3 py-2 font-medium">
                      {student.seatNumber}
                    </td>
                    <td className="px-3 py-2">{student.name}</td>
                    {student.cells.map((cell) => {
                      const key = `${student.studentId}:${cell.homeworkId}`;
                      const disabled =
                        !rowInteractive || busyKey === key;
                      return (
                        <td key={cell.homeworkId} className="px-2 py-2 text-center">
                          <button
                            type="button"
                            disabled={disabled}
                            onClick={() =>
                              onToggle(
                                student.studentId,
                                cell.homeworkId,
                                !cell.completed,
                              )
                            }
                            className={cn(
                              "mx-auto flex h-10 w-10 items-center justify-center rounded-lg border text-xl font-bold transition",
                              cell.completed
                                ? "border-emerald-400 bg-emerald-500 text-white"
                                : "border-rose-400/60 bg-rose-950/40 text-rose-200",
                              rowInteractive &&
                                !disabled &&
                                "hover:scale-105 cursor-pointer",
                              !rowInteractive && "cursor-default opacity-90",
                            )}
                          >
                            {cell.completed ? "✓" : ""}
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
