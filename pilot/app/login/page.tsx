import Link from "next/link";
import { googleLogin } from "./actions";
import { pilotConfig } from "../../lib/config";

export const dynamic = "force-dynamic";

export default async function Login({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  let ready = false;
  try { pilotConfig(); ready = true; } catch { /* Never render a working button for an unconfigured backend. */ }
  return <main style={{ maxWidth: 640, margin: "auto", padding: "48px 24px", lineHeight: 1.8 }}>
    <p>Teacher Workspace ／ 邀請試用版</p>
    <h1>導師登入</h1>
    <p>使用收到邀請的 Google 帳號登入。Google 驗證成功不代表已取得試用資格。</p>
    {!ready && <p role="status">新版登入環境尚在設定中，暫不開放登入。</p>}
    {error && <p role="alert">登入尚未完成，或服務暫時無法連線，請重試。若持續發生，請聯絡管理者。</p>}
    <form action={googleLogin}><button disabled={!ready} style={{ padding: "12px 24px", fontSize: 18 }}>使用 Google 帳號登入</button></form>
    <p>目前僅驗證登入與邀請資格，班級及學生功能尚未開放。</p>
    <Link href="/">返回開發狀態</Link>
  </main>;
}
