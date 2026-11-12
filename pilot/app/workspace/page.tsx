import { redirect } from "next/navigation";
import { serverClient } from "../../lib/supabase";
import { logout } from "../login/actions";
import { createClass, addStudent } from "./actions";
import { Submit } from "./submit";

export const dynamic = "force-dynamic";

export default async function Workspace({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const params = await searchParams;
  let client;
  try { client = await serverClient(); } catch { redirect("/login?error=unavailable"); }
  const { data: { user }, error } = await client.auth.getUser();
  if (error || !user) redirect("/login");
  let allowed = false;
  let unavailable = false;
  if (user.app_metadata.provider === "google") {
    const result = await client.rpc("register_pilot_teacher");
    allowed = !result.error && result.data === true;
    unavailable = Boolean(result.error);
  }
  const classes = allowed ? await client.from("pilot_classes").select("id,name").is("deleted_at", null) : null;
  const classroom = classes?.data?.[0];
  const students = classroom ? await client.from("pilot_students").select("id,seat,name").eq("class_id", classroom.id).is("deleted_at", null).order("seat") : null;
  const readError = Boolean(classes?.error || students?.error);
  return <main style={{ maxWidth: 900, margin: "auto", padding: "32px 24px", lineHeight: 1.8 }}>
    <p>Teacher Workspace ／ 小班試用版</p>
    <h1>{allowed ? classroom?.name ?? "建立你的班級" : unavailable ? "註冊服務尚未就緒" : "目前無法使用此帳號"}</h1>
    <p>目前登入：{user.email}</p>
    {!allowed && <p>{unavailable ? "新版資料庫尚未完成設定或連線失敗，請稍後重試。" : "請使用 Google 帳號；若帳號已被停用，請聯絡管理者。"}</p>}
    {readError && <p role="alert">資料暫時無法載入，請重新整理；目前不顯示建立表單，避免重複建立。</p>}
    {params.error && <p role="alert">{params.error === "student" ? "學生未能新增：請確認座號未重複、名冊未滿 15 人，再重試。" : params.error === "create" ? "班級未能建立：每人限一個使用中的班級，請重新整理確認。" : params.error === "logout" ? "登出未完成，請重試。" : "請檢查輸入內容後重試。"}</p>}
    {allowed && !readError && !classroom && <form action={createClass}>
      <label>班級名稱 <input name="name" required maxLength={80} placeholder="例如：四年甲班" style={{ padding: 10, maxWidth: "100%" }} /></label> <Submit>建立班級</Submit>
      <p>每位老師一個使用中的班級；首版最多 15 位學生。</p>
    </form>}
    {allowed && !readError && classroom && <section>
      <h2>學生名冊（{students?.data?.length ?? 0}／15）</h2>
      <ul>{students?.data?.map(student => <li key={student.id}>{student.seat} 號　{student.name}</li>)}</ul>
      {(students?.data?.length ?? 0) < 15 ? <form action={addStudent} style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "end" }}>
        <input type="hidden" name="classId" value={classroom.id} />
        <label>座號<br /><input name="seat" type="number" min={1} max={99} required style={{ width: 90, padding: 10 }} /></label>
        <label>學生姓名<br /><input name="name" required maxLength={80} style={{ padding: 10, maxWidth: "100%" }} /></label>
        <Submit>新增學生</Submit>
      </form> : <p>名冊已滿 15 人，不能再新增。</p>}
      <p>目前僅開放註冊、建立班級與新增名冊；編輯、移除及其他教室功能仍在開發。請先用虛構名冊驗收。</p>
    </section>}
    <form action={logout}><button style={{ padding: "12px 24px" }}>登出／更換帳號</button></form>
  </main>;
}
