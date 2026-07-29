import { Card, CardDescription, CardTitle } from "@/components/ui/card";

/** Action Widget shell — data will come from DashboardService later */
export function TodayTaskCard() {
  return (
    <Card>
      <CardTitle>今日工作</CardTitle>
      <CardDescription>操作型 Widget（待接 daily_task_completions）</CardDescription>
      <ul className="mt-4 space-y-2 text-sm text-gray-700">
        <li>□ 國語護照</li>
        <li>□ 英語護照</li>
        <li>□ 作業</li>
      </ul>
    </Card>
  );
}
