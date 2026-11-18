import Link from "next/link";
import {redirect} from "next/navigation";
import {serverClient} from "../../../lib/supabase";
import {moduleEnabled} from "../../../lib/modules";
import {taipeiToday,validDate,schoolDay,type Term} from "../../../lib/calendar";
import {returnTasks} from "../../../lib/return-days";
import {routineProgress} from "../../../lib/routines";
import {Submit} from "../submit";
import {saveReturnDay,setReturnTask} from "./actions";
export const dynamic="force-dynamic";
export default async function ReturnDays({searchParams}:{searchParams:Promise<{day?:string;notice?:string;error?:string}>}){
 if(process.env.PILOT_RETURN_DAYS_ENABLED!=="true")redirect("/workspace");const params=await searchParams;const day=params.day&&validDate(params.day)?params.day:taipeiToday();
 const client=await serverClient();const {data:{user},error}=await client.auth.getUser();if(error||!user)redirect("/login");
 const classes=await client.from("pilot_classes").select("id,name,enabled_modules");const classroom=classes.data?.[0];if(!classes.error&&!classroom)redirect("/workspace");const enabled=classroom&&moduleEnabled(classroom.enabled_modules,"routines");
 const [days,students,attendance,checks,terms]=enabled?await Promise.all([
  client.from("pilot_return_days").select("day,label,enabled").eq("class_id",classroom.id).order("day",{ascending:false}),
  client.from("pilot_students").select("id,seat,name").eq("class_id",classroom.id).is("deleted_at",null).order("seat"),
  client.from("pilot_attendance").select("student_id,absent").eq("class_id",classroom.id).eq("day",day),
  client.from("pilot_return_checks").select("student_id,task_key,completed").eq("class_id",classroom.id).eq("day",day),
  client.from("pilot_terms").select("*").eq("class_id",classroom.id).eq("active",true).maybeSingle(),
 ]):[null,null,null,null,null];
 const term=terms?.data as Term|null;const overrides=term?await client.from("pilot_day_overrides").select("day,is_school_day,note").eq("term_id",term.id).eq("day",day):null;
 const unavailable=classes.error||days?.error||students?.error||attendance?.error||checks?.error||terms?.error||overrides?.error;
 const selected=days?.data?.find(item=>item.day===day);const conflict=term&&schoolDay(day,term,overrides?.data??[]);const canEdit=selected?.enabled&&!conflict;
 return <main style={{maxWidth:1100,margin:"auto",padding:24,lineHeight:1.8}}><Link href="/workspace">← 返回工作台</Link><h1>返校日</h1><p>{classroom?.name}</p>
  <form method="get"><label>日期 <input type="date" name="day" defaultValue={day} min="2000-01-01" max="2100-12-31" required/></label> <button>查看返校日</button></form>
  {params.notice==="saved"&&<p role="status">返校日已儲存。</p>}{params.error&&<p role="alert">未能儲存。請確認日期、名冊、出缺席、模組與設定筆數；啟用學期上課日應使用一般每日任務。</p>}
  <p>返校日不會改變學期起訖、週次或作業繳交日。只有「上午打掃、交暑假作業」，出缺席仍<Link href={`/workspace/attendance?day=${day}`}>獨立設定</Link>。</p>
  {unavailable?<p role="alert">資料讀取失敗，暫不顯示統計或操作。</p>:!enabled?<p>請先開啟每日任務模組。</p>:<>
   <section><h2>{day} 設定</h2>{conflict&&<p>此日是啟用學期上課日，請使用<Link href={`/workspace/routines?day=${day}`}>一般每日任務</Link>；此處保留舊紀錄但不可勾選。</p>}
    <form action={saveReturnDay}><input type="hidden" name="classId" value={classroom!.id}/><input type="hidden" name="day" value={day}/><label>名稱 <input name="label" maxLength={60} defaultValue={selected?.label??"返校日"} required/></label> <label><input type="checkbox" name="enabled" value="yes" defaultChecked={selected?.enabled??false}/>啟用此日</label> <Submit>儲存返校日</Submit></form><p>每班最多保留 60 天設定；關閉不刪完成紀錄。</p>
   </section>
   {!selected&&<p>此日尚未設定，儲存並啟用後才開放任務。</p>}{selected&&!selected.enabled&&<p>此日已關閉，目前僅顯示原紀錄。</p>}
   {selected&&returnTasks.map(task=>{const progress=routineProgress(students?.data??[],checks?.data??[],attendance?.data??[],task.id);return <section key={task.id} style={{border:"1px solid #cbd5e1",borderRadius:10,padding:16,marginTop:16}}><h2>{task.name} {progress.completed}／{progress.total}</h2><p>{progress.missing.length?`未完成：${progress.missing.map(student=>student.name).join("、")}`:progress.total?"全部完成。":"沒有需要統計的出席學生。"}</p>
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(min(100%,260px),1fr))",gap:12}}>{progress.roster.map(student=><form key={student.id} action={setReturnTask} style={{border:"1px solid #cbd5e1",padding:12,borderRadius:8}}><strong>{student.seat} {student.name}</strong><p>{student.absent?"請假，不計入統計":student.completed?"已完成":"未完成"}</p><input type="hidden" name="classId" value={classroom!.id}/><input type="hidden" name="studentId" value={student.id}/><input type="hidden" name="day" value={day}/><input type="hidden" name="task" value={task.id}/><input type="hidden" name="state" value={String(!student.completed)}/>{canEdit&&!student.absent&&<Submit>{student.completed?"取消完成":"標記完成"}</Submit>}</form>)}</div>
   </section>;})}
   <details><summary>已建立日期（{days?.data?.length??0}）</summary><ul>{days?.data?.map(item=><li key={item.day}><Link href={`/workspace/return-days?day=${item.day}`}>{item.day} {item.label}（{item.enabled?"啟用":"關閉"}）</Link></li>)}</ul></details>
  </>}
  <p>此階段僅老師端記錄，不發扣金幣、XP，也不開放學生大屏操作。未確認出缺席者暫按出席，請假者原完成紀錄保留。</p>
 </main>;
}
