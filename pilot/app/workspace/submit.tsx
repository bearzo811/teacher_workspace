"use client";
import { useFormStatus } from "react-dom";
export function Submit({ children }: { children: string }) {
  const { pending } = useFormStatus();
  return <button disabled={pending} aria-busy={pending} style={{ padding: "10px 20px", fontSize: 16 }}>{pending ? "儲存中…" : children}</button>;
}
