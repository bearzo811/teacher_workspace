import Link from "next/link";
import {redirect} from "next/navigation";
import {serverClient} from "../../../lib/supabase";
import {moduleEnabled} from "../../../lib/modules";
import {validDate,taipeiToday,schoolDay,nextSchoolDay,type Term,type DayOverride} from "../../../lib/calendar";
import {Submit} from "../submit";
import {saveNotes,saveAssignment,archiveAssignment} from "./actions";
export const dynamic="force-dynamic";
type Book={id:string;subject:string;name:string;archived:boolean};
type Assignment={id:string;workbook_id:string;content:string;due_day:string;blocks_break:boolean;blocks_shop:boolean;archived:boolean};
const input={padding:8,maxWidth:"100%"};
function Fields({books,item}:{books:Book[];item?:Assignment}) {
 return <div style={{display:"flex",flexWrap:"wrap",gap:12,alignItems:"end"}}>
  <label>科目／簿本<br/><select name="workbookId" defaultValue={item?.workbook_id??""} required style={input}><option value="" disabled>請選簿本</option>{books.filter(book=>!book.archived||book.id===item?.workbook_id).map(book=><option key={book.id} value={book.id}>{book.subject}／{book.name}{book.archived?"（已停用）":""}</option>)}</select></label>
  <label>頁數／課次<br/><input name="content" defaultValue={item?.content} required maxLength={200} placeholder="例如：12-15、第一單元" style={input}/></label>
  <label><input type="checkbox" name="break" value="yes" defaultChecked={item?.blocks_break??true}/> 未完成影響下課</label>
  <label><input type="checkbox" name="shop" value="yes" defaultChecked={item?.blocks_shop??true}/> 未完成影響商店</label>
  <Submit>{item?"儲存修改":"加入作業"}</Submit>
 </div>;
}
export default async function ContactBook({searchParams}:{searchParams:Promise<{day?:string;error?:string;notice?:string}>}) {
 if(process.env.PILOT_CONTACT_BOOK_ENABLED!=="true") redirect("/workspace");
 const params=await searchParams;
 const day=params.day&&validDate(params.day)?params.day:taipeiToday();
 const client=await serverClient(); const {data:{user},error}=await client.auth.getUser();
 if(error||!user) redirect("/login");
 const classes=await client.from("pilot_classes").select("id,name,enabled_modules");
 const classroom=classes.data?.[0];
 if(!classes.error&&!classroom) redirect("/workspace");
 const enabled=classroom&&moduleEnabled(classroom.enabled_modules,"homework");
 const terms=enabled?await client.from("pilot_terms").select("*").eq("class_id",classroom.id).eq("active",true):null;
 const term=terms?.data?.[0] as Term|undefined;
 const [overrides,bookResult,notes,assignments]=enabled&&term?await Promise.all([
  client.from("pilot_day_overrides").select("day,is_school_day,note").eq("term_id",term.id),
  client.from("pilot_workbooks").select("id,subject,name,archived").eq("class_id",classroom.id).order("subject").order("name"),
  client.from("pilot_contact_days").select("notes").eq("class_id",classroom.id).eq("term_id",term.id).eq("day",day).maybeSingle(),
  client.from("pilot_assignments").select("id,workbook_id,content,due_day,blocks_break,blocks_shop,archived").eq("class_id",classroom.id).eq("term_id",term.id).eq("contact_day",day).order("id"),
 ]):[null,null,null,null];
 const unavailable=classes.error||terms?.error||overrides?.error||bookResult?.error||notes?.error||assignments?.error;
 const books=(bookResult?.data??[]) as Book[];
 const items=(assignments?.data??[]) as Assignment[];
 const active=items.filter(item=>!item.archived),archived=items.filter(item=>item.archived);
 const writable=term&&schoolDay(day,term,(overrides?.data??[]) as DayOverride[]);
 const due=term?nextSchoolDay(day,term,(overrides?.data??[]) as DayOverride[]):null;
 const scope=(item?:Assignment)=><><input type="hidden" name="classId" value={classroom?.id??""}/><input type="hidden" name="termId" value={term?.id??""}/><input type="hidden" name="day" value={day}/>{item&&<input type="hidden" name="assignmentId" value={item.id}/>}</>;
 const title=(item:Assignment)=>{const book=books.find(book=>book.id===item.workbook_id);return `${book?.subject??""}／${book?.name??"簿本"} ${item.content}`;};
 return <main style={{maxWidth:1000,margin:"auto",padding:24,lineHeight:1.8}}>
  <Link href="/workspace">← 返回工作台</Link><h1>聯絡簿</h1><p>{classroom?.name}</p>
  <form method="get"><label>聯絡簿日期 <input type="date" name="day" defaultValue={day} min="2000-01-01" max="2100-12-31" required style={input}/></label> <button>查看日期</button></form>
  {params.notice==="saved"&&<p role="status">已儲存。</p>}
  {params.error&&<p role="alert">無法儲存。請確認模組已開啟、日期是啟用學期的上課日、簿本可用且內容未超過限制。學期最後一天沒有後續上課日時，不能新增作業。每日最多保留 50 項（含移除）。</p>}
  {unavailable?<p role="alert">資料暫時無法載入，請重新整理；目前不顯示編輯表單，避免誤存。</p>:!enabled?<p>請先在工作台開啟「聯絡簿與作業」。關閉模組不會刪除資料。</p>:!term?<p>請先到<Link href="/workspace/calendar">學期與行事曆</Link>建立並啟用學期。</p>:<>
   <p>{term.name}｜{day} 抄寫｜新作業預計繳交：{due??"此學期內無下一上課日"}</p>
   {!writable&&<p role="status">此日期不是啟用學期的上課日，暫不開放新增或修改。請確認行事曆。</p>}
   <h2>作業項目</h2>{!active.length&&<p>尚無作業。</p>}
   {active.map(item=><article key={item.id} style={{border:"1px solid #cbd5e1",padding:16,borderRadius:8,marginBottom:12,overflowWrap:"anywhere"}}>
    <strong>{title(item)}</strong><p>繳交日：{item.due_day}｜下課：{item.blocks_break?"影響":"不影響"}｜商店：{item.blocks_shop?"影響":"不影響"}</p>
    {writable&&due&&<details><summary>編輯作業</summary><form action={saveAssignment}>{scope(item)}<Fields books={books} item={item}/></form></details>}
    <form action={archiveAssignment}>{scope(item)}<input type="hidden" name="mode" value="archive"/><label><input type="checkbox" name="confirm" value="yes" required/> 確認移除，可復原</label> <Submit>移除作業</Submit></form>
   </article>)}
   {writable&&due&&(books.some(book=>!book.archived)?<form action={saveAssignment}>{scope()}<Fields books={books}/></form>:<p>請先到<Link href="/workspace/workbooks">簿本管理</Link>新增簿本。</p>)}
   <h2>叮嚀／備註</h2><p>每行一項，不進入作業繳交表。</p>
   {writable?<form action={saveNotes}>{scope()}<textarea name="notes" defaultValue={notes?.data?.notes??""} maxLength={3000} rows={6} style={{width:"100%",boxSizing:"border-box",padding:12}} aria-label="叮嚀與備註"/><Submit>儲存叮嚀</Submit></form>:<p style={{whiteSpace:"pre-wrap"}}>{notes?.data?.notes||"尚無叮嚀。"}</p>}
   {!!archived.length&&<details><summary>已移除作業（{archived.length}）</summary><ul>{archived.map(item=><li key={item.id}>{title(item)}<form action={archiveAssignment}>{scope(item)}<input type="hidden" name="mode" value="restore"/><input type="hidden" name="confirm" value="yes"/><Submit>復原作業</Submit></form></li>)}</ul></details>}
   <p>目前完成老師端指派；學生繳交狀態、欠繳限制與大屏尚未接上，勾選限制會先保存設定。已儲存作業的繳交日不會因行事曆調整自動更動，需編輯該作業重新計算。</p>
  </>}
 </main>;
}
