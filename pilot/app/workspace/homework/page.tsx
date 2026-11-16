import Link from "next/link";
import {redirect} from "next/navigation";
import {serverClient} from "../../../lib/supabase";
import {moduleEnabled} from "../../../lib/modules";
import {taipeiToday,validDate} from "../../../lib/calendar";
import {homeworkStatuses,validHomeworkStatus,isHandedIn,type HomeworkStatus} from "../../../lib/homework";
import {Submit} from "../submit";
import {setHomeworkCheck} from "./actions";
export const dynamic="force-dynamic";
export default async function Homework({searchParams}:{searchParams:Promise<{day?:string;notice?:string;error?:string}>}) {
 if(process.env.PILOT_HOMEWORK_CHECKS_ENABLED!=="true") redirect("/workspace");
 const params=await searchParams;const day=params.day&&validDate(params.day)?params.day:taipeiToday();
 const client=await serverClient();const {data:{user},error}=await client.auth.getUser();
 if(error||!user) redirect("/login");
 const classes=await client.from("pilot_classes").select("id,name,enabled_modules");const classroom=classes.data?.[0];
 if(!classes.error&&!classroom) redirect("/workspace");
 const enabled=classroom&&moduleEnabled(classroom.enabled_modules,"homework");
 const [assignments,students,books]=enabled?await Promise.all([
  client.from("pilot_assignments").select("id,workbook_id,content,contact_day,due_day").eq("class_id",classroom.id).eq("due_day",day).eq("archived",false).order("contact_day").order("id").range(0,1000),
  client.from("pilot_students").select("id,seat,name").eq("class_id",classroom.id).is("deleted_at",null).order("seat"),
  client.from("pilot_workbooks").select("id,subject,name").eq("class_id",classroom.id),
 ]):[null,null,null];
 const ids=(assignments?.data??[]).map(item=>item.id);
 // At most 50 assignments × 15 students per batch: never silently hit PostgREST's 1000-row cap.
 const checkBatches=enabled&&students?.data?.length&&ids.length<=1000?await Promise.all(Array.from({length:Math.ceil(ids.length/50)},(_,index)=>client.from("pilot_homework_checks").select("assignment_id,student_id,status").eq("class_id",classroom.id).in("assignment_id",ids.slice(index*50,index*50+50)).in("student_id",(students?.data??[]).map(student=>student.id)))):[];
 const unavailable=classes.error||assignments?.error||students?.error||books?.error||checkBatches.some(batch=>batch.error)||ids.length>1000;
 const statusMap=new Map(checkBatches.flatMap(batch=>batch.data??[]).map(check=>[`${check.assignment_id}:${check.student_id}`,check.status]));
 const status=(assignment:string,student:string):HomeworkStatus=>{const value=statusMap.get(`${assignment}:${student}`)??"missing";return validHomeworkStatus(value)?value:"missing";};
 return <main style={{maxWidth:1200,margin:"auto",padding:24,lineHeight:1.8}}>
  <Link href="/workspace">← 返回工作台</Link><h1>作業檢核</h1><p>{classroom?.name}</p>
  <form method="get"><label>繳交日期 <input type="date" name="day" defaultValue={day} required style={{padding:8}}/></label> <button>查看應繳作業</button></form>
  {params.notice==="saved"&&<p role="status">狀態已儲存。</p>}{params.error&&<p role="alert">狀態未能儲存，請重新整理後確認作業、學生及模組仍可使用，再重試。</p>}
  {unavailable?<p role="alert">作業資料暫時無法載入，目前不顯示檢核表，避免誤判為未交。</p>:!enabled?<p>請先在工作台開啟「聯絡簿與作業」。</p>:<>
   <p>這裡顯示 {day} 應繳的作業，不是當天聯絡簿指派的作業。待確認、未訂正完成與已完成均算已交；只有已完成才算完成訂正。</p>
   {!ids.length&&<p>此繳交日沒有應繳作業。請到<Link href="/workspace/contact-book">聯絡簿</Link>確認指派與繳交日期。</p>}
   {!!ids.length&&!(students?.data?.length)&&<p>班級尚無使用中學生，請先新增名冊。</p>}
   {(assignments?.data??[]).map(item=>{const book=books?.data?.find(book=>book.id===item.workbook_id);const roster=students?.data??[];const handed=roster.filter(student=>isHandedIn(status(item.id,student.id))).length;return <section key={item.id} style={{border:"1px solid #cbd5e1",borderRadius:8,padding:16,marginTop:20}}>
    <h2 style={{overflowWrap:"anywhere"}}>{book?.subject}／{book?.name} {item.content}</h2><p>聯絡簿：{item.contact_day}｜繳交日：{item.due_day}｜已交 {handed}／{roster.length}</p>
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(min(100%,280px),1fr))",gap:12}}>{roster.map(student=><form key={student.id} action={setHomeworkCheck} style={{border:"1px solid #cbd5e1",padding:12,borderRadius:6}}>
     <strong>{student.seat} 號 {student.name}</strong><p>目前：{homeworkStatuses.find(itemStatus=>itemStatus.id===status(item.id,student.id))?.name}</p>
     <input type="hidden" name="classId" value={classroom.id}/><input type="hidden" name="assignmentId" value={item.id}/><input type="hidden" name="studentId" value={student.id}/><input type="hidden" name="day" value={day}/>
     <label>調整狀態 <select name="status" defaultValue={status(item.id,student.id)} style={{padding:8,maxWidth:"100%"}}>{homeworkStatuses.map(option=><option key={option.id} value={option.id}>{option.name}</option>)}</select></label> <Submit>儲存</Submit>
    </form>)}</div>
   </section>;})}
   <p>目前為老師端檢核；學生大屏自助、欠繳清單及金幣尚未串接。本次儲存不會發放或扣除金幣。</p>
  </>}
 </main>;
}
