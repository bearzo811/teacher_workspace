import { Card, CardDescription, CardTitle } from "@/components/ui/card";

type StudentDetailPageProps = {
  params: Promise<{ id: string }>;
};

export default async function StudentDetailPage({
  params,
}: StudentDetailPageProps) {
  const { id } = await params;

  return (
    <div className="mx-auto w-full max-w-4xl">
      <h1 className="text-2xl font-semibold text-gray-900">學生詳細</h1>
      <Card className="mt-6">
        <CardTitle>StudentDetailPage 殼層</CardTitle>
        <CardDescription>學生 id：{id}（Sprint 6）</CardDescription>
      </Card>
    </div>
  );
}
