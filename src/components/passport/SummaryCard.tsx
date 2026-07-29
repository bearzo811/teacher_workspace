import { Card, CardDescription, CardTitle } from "@/components/ui/card";

type SummaryCardProps = {
  week: number;
  completed: number;
  incomplete: number;
};

export function SummaryCard({ week, completed, incomplete }: SummaryCardProps) {
  return (
    <Card>
      <CardTitle>第 {week} 週</CardTitle>
      <CardDescription>完成統計</CardDescription>
      <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
        <div>
          <dt className="text-gray-500">完成</dt>
          <dd className="text-xl font-semibold text-green-600">{completed}</dd>
        </div>
        <div>
          <dt className="text-gray-500">未完成</dt>
          <dd className="text-xl font-semibold text-red-600">{incomplete}</dd>
        </div>
      </dl>
    </Card>
  );
}
