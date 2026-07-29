import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import type { PassportDashboardCard } from "@/types/dashboard";

type ProgressCardProps = {
  title: string;
  /** Homework / placeholder mode */
  pendingLabel?: string;
  /** Passport mode — from DashboardService */
  passport?: PassportDashboardCard;
};

/** Data Widget — values must come from DashboardService / API */
export function ProgressCard({
  title,
  pendingLabel,
  passport,
}: ProgressCardProps) {
  if (!passport) {
    return (
      <Card>
        <CardTitle>{title}</CardTitle>
        <CardDescription>資料型 Widget</CardDescription>
        <p className="mt-4 text-2xl font-semibold text-gray-900">
          {pendingLabel ?? "— / —"}
        </p>
      </Card>
    );
  }

  return (
    <Card>
      <CardTitle>{title}</CardTitle>
      <CardDescription>第 {passport.week} 週為目前週</CardDescription>

      <dl className="mt-4 grid grid-cols-2 gap-3">
        <div>
          <dt className="text-xs text-gray-500">本週</dt>
          <dd className="text-xl font-semibold text-gray-900">
            {passport.weekCompleted} / {passport.weekTotal}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-gray-500">全部</dt>
          <dd className="text-xl font-semibold text-gray-900">
            {passport.overallCompleted} / {passport.overallTotal}
          </dd>
        </div>
      </dl>

      <div className="mt-4 border-t border-gray-100 pt-3">
        <p className="text-xs font-medium text-gray-600">
          有欠（至第 {passport.week} 週）
        </p>
        {passport.owedStudents.length === 0 ? (
          <p className="mt-1 text-sm text-gray-400">沒有欠交</p>
        ) : (
          <ul className="mt-1 max-h-36 space-y-1 overflow-y-auto text-sm text-gray-700">
            {passport.owedStudents.map((student) => (
              <li key={`${student.seatNumber}-${student.name}`}>
                {student.name}
              </li>
            ))}
          </ul>
        )}
      </div>
    </Card>
  );
}
