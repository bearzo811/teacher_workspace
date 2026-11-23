"use client";
import { useFormStatus } from "react-dom";
export function Submit({ children,pendingLabel="儲存中…",fontSize=16 }: { children: string;pendingLabel?:string;fontSize?:number }) {
  const { pending } = useFormStatus();
  return <button disabled={pending} aria-busy={pending} style={{ padding: "10px 20px", fontSize }}>{pending ? pendingLabel : children}</button>;
}
