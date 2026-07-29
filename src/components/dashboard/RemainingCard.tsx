import { Card, CardDescription, CardTitle } from "@/components/ui/card";

/** Data Widget shell — remaining lists from DashboardService only */
export function RemainingCard() {
  return (
    <Card>
      <CardTitle>未完成</CardTitle>
      <CardDescription>資料型 Widget（待接 DashboardService）</CardDescription>
      <div className="mt-4 space-y-3 text-sm text-gray-500">
        <p>國語：—</p>
        <p>英語：—</p>
        <p>作業：—</p>
      </div>
    </Card>
  );
}
