"use client";
import { useFormStatus } from "react-dom";
export function Submit({ children,pendingLabel="儲存中…",fontSize=16,compact=false,ariaLabel }: { children: string;pendingLabel?:string;fontSize?:number|string;compact?:boolean;ariaLabel?:string }) {
  const { pending } = useFormStatus();
  return <button disabled={pending} aria-busy={pending} aria-label={ariaLabel} style={{ padding:compact?"8px 2px":"10px 20px",fontSize,width:compact?'100%':undefined,minHeight:compact?44:undefined,minWidth:compact?44:undefined }}>{pending ? pendingLabel : children}</button>;
}
