import { RemainingCard } from "@/components/dashboard/RemainingCard";
import { ProgressCard } from "@/components/dashboard/ProgressCard";
import { QuickActionCard } from "@/components/dashboard/QuickActionCard";
import { TodayTaskCard } from "@/components/dashboard/TodayTaskCard";

function formatTodayLabel(date: Date) {
  const weekdays = ["日", "一", "二", "三", "四", "五", "六"];
  return `${date.getMonth() + 1}/${date.getDate()}（${weekdays[date.getDay()]}）`;
}

export default function DashboardPage() {
  const todayLabel = formatTodayLabel(new Date());

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <header>
        <h1 className="text-2xl font-semibold text-gray-900">Dashboard</h1>
        <p className="mt-1 text-sm text-gray-500">今天 {todayLabel}</p>
      </header>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <TodayTaskCard />
        <ProgressCard title="國語完成率" />
        <ProgressCard title="英語完成率" />
        <ProgressCard title="作業完成率" />
        <RemainingCard />
        <QuickActionCard />
      </div>
    </div>
  );
}
