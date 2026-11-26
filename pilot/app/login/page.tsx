import Link from "next/link";
import { googleLogin } from "./actions";
import { pilotConfig } from "../../lib/config";

export const dynamic = "force-dynamic";

export default async function Login({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  let ready = false;
  try { pilotConfig(); ready = true; } catch { /* Never render a working button for an unconfigured backend. */ }
  return <main style={{ maxWidth: 640, margin: "auto", padding: "48px 24px", lineHeight: 1.8 }}>
    <p>Teacher Workspace ／ 小班試用版</p>
    <h1>導師註冊／登入</h1>
    <p>使用 Google 帳號即可註冊，不需邀請碼或人工核准。每人一個使用中的班級，最多 15 位學生。</p>
    {!ready && <p role="status">新版登入環境尚在設定中，暫不開放登入。</p>}
    {error && <p role="alert">登入尚未完成，或服務暫時無法連線，請重試。若持續發生，請聯絡管理者。</p>}
    <form action={googleLogin}><button disabled={!ready} style={{ padding: "12px 24px", fontSize: 18 }}>使用 Google 帳號登入</button></form>
    <p>試用版仍在開發與驗收。可先<Link href="/demo">用虛構班級試玩</Link>，或查看<Link href="/guide">第一次使用導覽</Link>，再建立自己的班級。</p>
    <Link href="/">返回首頁</Link>
  </main>;
}
