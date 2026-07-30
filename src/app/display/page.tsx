import { Suspense } from "react";
import { DisplayPageClient } from "@/components/display/DisplayPageClient";

export default function DisplayPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[70vh] items-center justify-center">
          <p className="text-2xl text-slate-400">載入教室大屏…</p>
        </div>
      }
    >
      <DisplayPageClient />
    </Suspense>
  );
}
