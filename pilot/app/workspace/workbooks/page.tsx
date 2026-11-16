import Link from "next/link";
import {redirect} from "next/navigation";
import {serverClient} from "../../../lib/supabase";
import {moduleEnabled} from "../../../lib/modules";
import {Submit} from "../submit";
import {saveWorkbook,archiveWorkbook} from "./actions";
export const dynamic="force-dynamic";
type Workbook={id:string;subject:string;name:string;archived:boolean};
const input={padding:10,maxWidth:"100%"};
function Fields({book}:{book?:Workbook}) {
  return <div style={{display:"flex",flexWrap:"wrap",gap:12,alignItems:"end"}}>
    <label>科目<br/><input name="subject" defaultValue={book?.subject} required maxLength={40} placeholder="例如：數學" style={input}/></label>
    <label>簿本名稱<br/><input name="name" defaultValue={book?.name} required maxLength={40} placeholder="例如：數習" style={input}/></label>
    <Submit>{book?"儲存修改":"新增簿本"}</Submit>
  </div>;
}
export default async function Workbooks({searchParams}:{searchParams:Promise<{error?:string;notice?:string}>}) {
  if(process.env.PILOT_WORKBOOKS_ENABLED!=="true") redirect("/workspace");
  const params=await searchParams;
  const client=await serverClient();
  const {data:{user},error}=await client.auth.getUser();
  if(error||!user) redirect("/login");
  const classes=await client.from("pilot_classes").select("id,name,enabled_modules");
  const classroom=classes.data?.[0];
  if(!classes.error&&!classroom) redirect("/workspace");
  const enabled=classroom&&moduleEnabled(classroom.enabled_modules,"homework");
  const result=enabled?await client.from("pilot_workbooks").select("id,subject,name,archived").eq("class_id",classroom.id).order("subject").order("name"):null;
  const books=(result?.data??[]) as Workbook[];
  const active=books.filter(book=>!book.archived),archived=books.filter(book=>book.archived);
  const unavailable=classes.error||result?.error;
  const scope=(book?:Workbook)=><><input type="hidden" name="classId" value={classroom?.id??""}/>{book&&<input type="hidden" name="workbookId" value={book.id}/>}</>;
  return <main style={{maxWidth:900,margin:"auto",padding:24,lineHeight:1.8}}>
    <Link href="/workspace">← 返回工作台</Link><h1>簿本管理</h1><p>{classroom?.name}</p>
    {params.notice==="saved"&&<p role="status">簿本設定已儲存。</p>}
    {params.error&&<p role="alert">{params.error==="input"?"請填寫科目及簿本名稱（各最多 40 字），停用前需勾選確認。":"無法儲存。請確認模組已開啟、同科目沒有同名簿本，且總數未達 100 本；復原時也不能與現用簿本重名。"}</p>}
    {unavailable?<p role="alert">簿本暫時無法載入，請重新整理；目前不顯示修改表單，避免重複建立。</p>:!enabled?<p>尚未開啟「聯絡簿與作業」。請回工作台調整功能模組；原有簿本資料會保留。</p>:<>
      <p>先建立科目與簿本，例如數學／數習、數學／數重。停用不刪資料，日後可復原。</p>
      <h2>新增簿本</h2><form action={saveWorkbook}>{scope()}<Fields/></form><p>每班最多保留 100 本（含停用）。停用後不能新增指派，但既有作業仍可檢核。</p>
      <h2>使用中（{active.length}）</h2>{!active.length&&<p>尚未建立簿本。</p>}
      {active.map(book=><article key={book.id} style={{border:"1px solid #cbd5e1",borderRadius:8,padding:16,marginBottom:12}}>
        <h3 style={{overflowWrap:"anywhere"}}>{book.subject}／{book.name}</h3>
        <details><summary>編輯簿本</summary><form action={saveWorkbook}>{scope(book)}<Fields book={book}/></form></details>
        <form action={archiveWorkbook}>{scope(book)}<input type="hidden" name="mode" value="archive"/><label><input type="checkbox" name="confirm" value="yes" required/> 確認停用，不永久刪除</label> <Submit>停用簿本</Submit></form>
      </article>)}
      {!!archived.length&&<details><summary>已停用（{archived.length}）</summary><ul>{archived.map(book=><li key={book.id}>{book.subject}／{book.name}<form action={archiveWorkbook}>{scope(book)}<input type="hidden" name="mode" value="restore"/><input type="hidden" name="confirm" value="yes"/><Submit>復原簿本</Submit></form></li>)}</ul></details>}
    </>}
  </main>;
}
