import { redirect } from "next/navigation";
import { serverClient } from "../../lib/supabase";
import { logout } from "../login/actions";
import { createClass, addStudent, renameClass, updateStudent, archiveStudent, restoreStudent, configureModules } from "./actions";
import { Submit } from "./submit";
import { ModuleFields } from "./module-fields";
import { modules } from "../../lib/modules";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function Workspace({ searchParams }: { searchParams: Promise<{ error?: string; notice?: string }> }) {
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
  const moduleSelectionReady = process.env.PILOT_MODULE_SELECTION_ENABLED === "true";
  const classes = allowed ? await client.from("pilot_classes").select("*").is("deleted_at", null) : null;
  const classroom = classes?.data?.[0];
  const students = classroom ? await client.from("pilot_students").select("id,seat,name,deleted_at").eq("class_id", classroom.id).order("seat") : null;
  const activeStudents = students?.data?.filter(student => !student.deleted_at) ?? [];
  const archivedStudents = students?.data?.filter(student => student.deleted_at) ?? [];
  const readError = Boolean(classes?.error || students?.error);
  const managementReady = process.env.PILOT_ROSTER_MANAGEMENT_ENABLED === "true";
  return <main style={{ maxWidth: 900, margin: "auto", padding: "32px 24px", lineHeight: 1.8 }}>
    <p>Teacher Workspace ／ 小班試用版</p>
    <h1>{allowed ? classroom?.name ?? "建立你的班級" : unavailable ? "註冊服務尚未就緒" : "目前無法使用此帳號"}</h1>
    <p>目前登入：{user.email}</p>
    {params.notice === "modules" && <p role="status">功能選擇已儲存。</p>}
    {params.error === "modules" && <p role="alert">功能選擇未能儲存，請稍後重試。</p>}
    {!allowed && <p>{unavailable ? "新版資料庫尚未完成設定或連線失敗，請稍後重試。" : "請使用 Google 帳號；若帳號已被停用，請聯絡管理者。"}</p>}
    {readError && <p role="alert">資料暫時無法載入，請重新整理；目前不顯示建立表單，避免重複建立。</p>}
    {params.error && <p role="alert">{params.error === "student" ? "學生資料未能儲存：請確認座號未重複、名冊未滿 15 人，再重試。" : params.error === "restore" ? "無法復原：請確認名冊未滿 15 人，且原座號沒有被使用。" : params.error === "archive" ? "學生尚未移除，請稍後重試。" : params.error === "confirm" ? "請先勾選確認移除；資料會保留供復原。" : params.error === "rename" ? "班級名稱未能儲存，請稍後重試。" : params.error === "create" ? "班級未能建立：每人限一個使用中的班級，請重新整理確認。" : params.error === "logout" ? "登出未完成，請重試。" : "請檢查輸入內容後重試。"}</p>}
    {allowed && !readError && !classroom && <form action={createClass}>
      <label>班級名稱 <input name="name" required maxLength={80} placeholder="例如：四年甲班" style={{ padding: 10, maxWidth: "100%" }} /></label>
      {moduleSelectionReady && <ModuleFields />}
      <Submit>建立班級</Submit>
      <p>每位老師一個使用中的班級；首版最多 15 位學生。</p>
    </form>}
    {allowed && !readError && classroom && <section>
      {process.env.PILOT_CALENDAR_ENABLED === "true" && <p><Link href="/workspace/calendar">學期與行事曆 →</Link></p>}
      {moduleSelectionReady && <section aria-label="班級功能設定">
        <h2>{classroom.modules_configured_at ? "班級功能" : "先選擇你的班級需要哪些功能"}</h2>
        {classroom.modules_configured_at && <p>已選擇：{modules.filter(module => classroom.enabled_modules?.includes(module.id)).map(module => module.name).join("、") || "僅基本功能"}（選用模組尚在開發）</p>}
        <details open={!classroom.modules_configured_at}>
          <summary>調整功能模組</summary>
          <form action={configureModules}>
            <input type="hidden" name="classId" value={classroom.id} />
            <ModuleFields selected={classroom.enabled_modules ?? []} />
            <Submit>儲存功能選擇</Submit>
          </form>
        </details>
      </section>}
      {managementReady && <details><summary>修改班級名稱</summary><form action={renameClass}>
        <input type="hidden" name="classId" value={classroom.id} />
        <label>班級名稱 <input name="name" defaultValue={classroom.name} required maxLength={80} style={{ padding: 8, maxWidth: "100%" }} /></label> <Submit>儲存班名</Submit>
      </form></details>}
      <h2>學生名冊（{activeStudents.length}／15）</h2>
      <ul style={{ padding: 0, listStyle: "none" }}>{activeStudents.map(student => <li key={student.id} style={{ padding: "12px 0", borderBottom: "1px solid #cbd5e1" }}>
        <strong>{student.seat} 號　{student.name}</strong>
        {managementReady && <details><summary>編輯／移除 {student.seat} 號學生</summary>
          <form action={updateStudent} style={{ display: "flex", flexWrap: "wrap", gap: 10, padding: "12px 0" }}>
            <input type="hidden" name="studentId" value={student.id} />
            <label>座號 <input name="seat" type="number" min={1} max={99} defaultValue={student.seat} required style={{ width: 70, padding: 8 }} /></label>
            <label>姓名 <input name="name" defaultValue={student.name} maxLength={80} required style={{ padding: 8, maxWidth: "100%" }} /></label>
            <Submit>儲存修改</Submit>
          </form>
          <form action={archiveStudent}>
            <input type="hidden" name="studentId" value={student.id} />
            <label><input type="checkbox" name="confirm" value="yes" required /> 確認從名冊移除，資料保留可復原</label> <Submit>移至已移除名單</Submit>
          </form>
        </details>}
      </li>)}</ul>
      {activeStudents.length < 15 ? <form action={addStudent} style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "end" }}>
        <input type="hidden" name="classId" value={classroom.id} />
        <label>座號<br /><input name="seat" type="number" min={1} max={99} required style={{ width: 90, padding: 10 }} /></label>
        <label>學生姓名<br /><input name="name" required maxLength={80} style={{ padding: 10, maxWidth: "100%" }} /></label>
        <Submit>新增學生</Submit>
      </form> : <p>名冊已滿 15 人，不能再新增。</p>}
      {managementReady && archivedStudents.length > 0 && <details><summary>已移除學生（{archivedStudents.length}）</summary>
        <ul>{archivedStudents.map(student => <li key={student.id}>{student.seat} 號　{student.name}
          <form action={restoreStudent}><input type="hidden" name="studentId" value={student.id} /><Submit>復原至名冊</Submit></form>
        </li>)}</ul>
      </details>}
      <p>目前僅開放註冊、班級與名冊；其他教室功能仍在開發。請先用虛構名冊驗收。</p>
    </section>}
    <form action={logout}><button style={{ padding: "12px 24px" }}>登出／更換帳號</button></form>
  </main>;
}
