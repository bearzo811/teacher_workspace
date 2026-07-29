import { Card, CardDescription, CardTitle } from "@/components/ui/card";

type ProgressCardProps = {
  title: string;
  completed?: number;
  total?: number;
  week?: number;
  pendingLabel?: string;
};

/** Data Widget — values must come from DashboardService / API */
export function ProgressCard({
  title,
  completed,
  total,
  week,
  pendingLabel,
}: ProgressCardProps) {
  const ready = typeof completed === "number" && typeof total === "number";

  return (
    <Card>
      <CardTitle>{title}</CardTitle>
      <CardDescription>
        {week !== undefined ? `第 ${week} 週（目前週）` : "資料型 Widget"}
      </CardDescription>
      <p className="mt-4 text-2xl font-semibold text-gray-900">
        {ready ? `${completed} / ${total}` : (pendingLabel ?? "— / —")}
      </p>
    </Card>
  );
}
