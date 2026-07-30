import { Suspense } from "react";
import { HomeworkPageClient } from "@/components/homework/HomeworkPageClient";

export default function HomeworkPage() {
  return (
    <Suspense fallback={<p className="text-sm text-gray-400">載入中…</p>}>
      <HomeworkPageClient />
    </Suspense>
  );
}
