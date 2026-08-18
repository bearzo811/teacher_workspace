"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";

export default function LoginPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const json = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(json.error ?? "登入失敗");
      const next = new URLSearchParams(window.location.search).get("next");
      router.replace(next?.startsWith("/") ? next : "/");
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "登入失敗");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
      <Card className="w-full max-w-md">
        <div>
          <CardTitle>老師登入</CardTitle>
          <CardDescription>請輸入管理端密碼。</CardDescription>
        </div>
        <div className="mt-5">
          <form className="space-y-4" onSubmit={submit}>
            <label className="grid gap-2 text-sm font-medium text-slate-700">
              密碼
              <input
                autoComplete="current-password"
                className="h-11 rounded-md border border-slate-300 px-3 text-base outline-none ring-blue-500 focus:ring-2"
                onChange={(event) => setPassword(event.target.value)}
                required
                type="password"
                value={password}
              />
            </label>
            {error ? <p className="text-sm text-red-600">{error}</p> : null}
            <Button className="w-full" disabled={submitting} type="submit">
              {submitting ? "登入中…" : "登入"}
            </Button>
          </form>
        </div>
      </Card>
    </main>
  );
}
