import { Card, CardDescription, CardTitle } from "@/components/ui/card";

export default function HomeworkPage() {
  return (
    <div className="mx-auto w-full max-w-4xl">
      <h1 className="text-2xl font-semibold text-gray-900">作業管理</h1>
      <Card className="mt-6">
        <CardTitle>HomeworkPage 殼層</CardTitle>
        <CardDescription>Sprint 5 實作。目前僅路由佔位。</CardDescription>
      </Card>
    </div>
  );
}
