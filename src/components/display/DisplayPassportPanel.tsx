import { cn } from "@/lib/utils";
import {
  PASSPORT_STATUS_LABEL,
  type PassportStatus,
} from "@/types/passport";
import type { PassportWeekView } from "@/services/passportService";

type DisplayPassportPanelProps = {
  chinese: PassportWeekView;
  english: PassportWeekView;
  activeStudentId: string | null;
  canToggle: boolean;
  busyKey: string | null;
  onToggle: (
    studentId: string,
    type: "Chinese" | "English",
    week: number,
    current: PassportStatus,
  ) => void;
};

function statusClass(status: PassportStatus) {
  switch (status) {
    case "completed":
      return "border-emerald-400 bg-emerald-500 text-white";
    case "missing_parent":
      return "border-rose-400 bg-rose-500/90 text-white";
    default:
      return "border-slate-500 bg-slate-800 text-slate-400";
  }
}

function statusMark(status: PassportStatus) {
  switch (status) {
    case "completed":
      return "✓";
    case "missing_parent":
      return "缺";
    default:
      return "";
  }
}

function PassportColumn({
  title,
  view,
  activeStudentId,
  canToggle,
  busyKey,
  onToggle,
}: {
  title: string;
  view: PassportWeekView;
  activeStudentId: string | null;
  canToggle: boolean;
  busyKey: string | null;
  onToggle: DisplayPassportPanelProps["onToggle"];
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col rounded-xl border border-slate-700 bg-slate-950/50 p-4">
      <div className="mb-3 flex items-end justify-between gap-2">
        <div>
          <h3 className="text-xl font-semibold md:text-2xl">{title}</h3>
          <p className="text-sm text-slate-400 md:text-base">
            第 {view.week} 週
          </p>
        </div>
        <p className="text-lg text-emerald-300 md:text-xl">
          {view.completedCount} / {view.totalCount}
        </p>
      </div>
      <ul className="grid grid-cols-1 gap-2 overflow-auto sm:grid-cols-2">
        {view.students.map((student) => {
          const isActive = activeStudentId === student.studentId;
          const interactive = canToggle && isActive;
          const key = `${student.studentId}:${view.type}:${view.week}`;
          return (
            <li key={student.studentId}>
              <button
                type="button"
                disabled={!interactive || busyKey === key}
                onClick={() =>
                  onToggle(
                    student.studentId,
                    view.type,
                    view.week,
                    student.status,
                  )
                }
                className={cn(
                  "flex w-full items-center gap-3 rounded-xl border px-3 py-2 text-left transition",
                  statusClass(student.status),
                  interactive && "hover:brightness-110 cursor-pointer",
                  !interactive && "cursor-default",
                  isActive && "ring-2 ring-sky-400",
                )}
                title={PASSPORT_STATUS_LABEL[student.status]}
              >
                <span className="w-8 text-lg font-semibold">
                  {student.seatNumber}
                </span>
                <span className="flex-1 truncate text-lg md:text-xl">
                  {student.name}
                </span>
                <span className="text-xl font-bold">
                  {statusMark(student.status)}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function DisplayPassportPanel({
  chinese,
  english,
  activeStudentId,
  canToggle,
  busyKey,
  onToggle,
}: DisplayPassportPanelProps) {
  return (
    <section className="flex h-full flex-col gap-4 rounded-2xl border border-slate-700 bg-slate-900/80 p-4 md:p-6">
      <header>
        <h2 className="text-2xl font-semibold md:text-3xl">本週護照</h2>
        <p className="mt-1 text-base text-slate-400 md:text-lg">
          國語／英語 · 第 {chinese.week} 週
        </p>
      </header>
      <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-2">
        <PassportColumn
          title="國語護照"
          view={chinese}
          activeStudentId={activeStudentId}
          canToggle={canToggle}
          busyKey={busyKey}
          onToggle={onToggle}
        />
        <PassportColumn
          title="英語護照"
          view={english}
          activeStudentId={activeStudentId}
          canToggle={canToggle}
          busyKey={busyKey}
          onToggle={onToggle}
        />
      </div>
    </section>
  );
}
