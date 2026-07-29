import { Card, CardDescription, CardTitle } from "@/components/ui/card";

type ProgressCardProps = {
  title: string;
  /** Placeholder until DashboardService is wired */
  placeholder?: string;
};

/** Data Widget shell — must not compute rates locally */
export function ProgressCard({
  title,
  placeholder = "— / —",
}: ProgressCardProps) {
  return (
    <Card>
      <CardTitle>{title}</CardTitle>
      <CardDescription>資料型 Widget（待接 DashboardService）</CardDescription>
      <p className="mt-4 text-2xl font-semibold text-gray-900">{placeholder}</p>
    </Card>
  );
}
