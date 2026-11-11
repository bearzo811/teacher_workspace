import { redirect } from "next/navigation";
import { serverClient } from "../../lib/supabase";
import { logout } from "../login/actions";

export const dynamic = "force-dynamic";

export default async function Workspace() {
  let client;
  try { client = await serverClient(); } catch { redirect("/login?error=unavailable"); }
  const { data: { user }, error } = await client.auth.getUser();
  if (error || !user) redirect("/login");
  let allowed = false;
  let unavailable = false;
  if (user.app_metadata.provider === "google") {
    const result = await client.rpc("accept_pilot_invitation");
    allowed = !result.error && result.data === true;
    unavailable = Boolean(result.error);
  }
  return <main style={{ maxWidth: 760, margin: "auto", padding: "48px 24px", lineHeight: 1.8 }}>
    <p>Teacher Workspace ／ 邀請試用版</p>
    <h1>{allowed ? "邀請資格已確認" : unavailable ? "暫時無法確認試用資格" : "此帳號尚未取得試用資格"}</h1>
    <p>目前登入：{user.email}</p>
    <p>{allowed ? "登入與邀請驗證已完成。班級建立及各項教室功能仍在開發，尚未開放學生資料操作。" : unavailable ? "邀請服務尚未就緒或連線失敗，請稍後重試；目前不開放任何班級資料。" : "請改用收到邀請的 Google 帳號，或聯絡管理者確認。此帳號不能讀取或建立班級。"}</p>
    <form action={logout}><button style={{ padding: "12px 24px" }}>登出／更換帳號</button></form>
  </main>;
}
