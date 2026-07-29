import { Card, CardDescription, CardTitle } from "@/components/ui/card";

export default function EnglishPassportPage() {
  return (
    <div className="mx-auto w-full max-w-4xl">
      <h1 className="text-2xl font-semibold text-gray-900">英語護照</h1>
      <Card className="mt-6">
        <CardTitle>PassportPage 殼層</CardTitle>
        <CardDescription>
          與國語護照共用元件（Sprint 3／4）。目前僅路由佔位。
        </CardDescription>
      </Card>
    </div>
  );
}
