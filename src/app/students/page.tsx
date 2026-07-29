import { Card, CardDescription, CardTitle } from "@/components/ui/card";

export default function StudentsPage() {
  return (
    <div className="mx-auto w-full max-w-4xl">
      <h1 className="text-2xl font-semibold text-gray-900">學生中心</h1>
      <Card className="mt-6">
        <CardTitle>StudentsPage 殼層</CardTitle>
        <CardDescription>Sprint 2／6 實作。目前僅路由佔位。</CardDescription>
      </Card>
    </div>
  );
}
