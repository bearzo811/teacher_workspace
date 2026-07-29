import { Card, CardDescription, CardTitle } from "@/components/ui/card";

export default function SettingsPage() {
  return (
    <div className="mx-auto w-full max-w-4xl">
      <h1 className="text-2xl font-semibold text-gray-900">系統設定</h1>
      <Card className="mt-6">
        <CardTitle>SettingsPage 殼層</CardTitle>
        <CardDescription>
          class_settings（Sprint 7）。目前僅路由佔位。
        </CardDescription>
      </Card>
    </div>
  );
}
