import Link from "next/link";
import {redirect} from "next/navigation";
import {serverClient} from "../../../lib/supabase";
import {moduleEnabled} from "../../../lib/modules";
import {taipeiToday,validDate,schoolDay,type Term} from "../../../lib/calendar";
import {routineTasks,routineProgress} from "../../../lib/routines";
import {Submit} from "../submit";
import {setRoutine} from "./actions";
export const dynamic="force-dynamic";
export default async function Routines({searchParams}:{searchParams:Promise<{day?:string;notice?:string;error?:string}>}){
 if(process.env.PILOT_ROUTINES_ENABLED!=="true")redirect("/workspace");
 const params=await searchParams;const day=params.day&&validDate(params.day)?params.day:taipeiToday();
 const client=await serverClient();const {data:{user},error}=await client.auth.getUser();if(error||!user)redirect("/login");
 const classes=await client.from("pilot_classes").select("id,name,enabled_modules");const classroom=classes.data?.[0];
 if(!classes.error&&!classroom)redirect("/workspace");
 const enabled=classroom&&moduleEnabled(classroom.enabled_modules,"routines");
 const terms=enabled?await client.from("pilot_terms").select("*").eq("class_id",classroom.id).eq("active",true).maybeSingle():null;
 const term=terms?.data as Term|null;
 const [students,attendance,checks,overrides,contact]=enabled&&term?await Promise.all([
  client.from("pilot_students").select("id,seat,name").eq("class_id",classroom.id).is("deleted_at",null).order("seat"),
  client.from("pilot_attendance").select("student_id,absent").eq("class_id",classroom.id).eq("day",day),
  client.from("pilot_routine_checks").select("student_id,task_key,completed").eq("class_id",classroom.id).eq("term_id",term.id).eq("day",day),
  client.from("pilot_day_overrides").select("day,is_school_day,note").eq("term_id",term.id).eq("day",day),
  moduleEnabled(classroom.enabled_modules,"homework")?client.from("pilot_contact_days").select("day").eq("class_id",classroom.id).eq("term_id",term.id).eq("day",day).maybeSingle():Promise.resolve(null),
 ]):[null,null,null,null,null];
 const unavailable=classes.error||terms?.error||students?.error||attendance?.error||checks?.error||overrides?.error||contact?.error;
 const school=term&&schoolDay(day,term,overrides?.data??[]);
 return <main style={{maxWidth:1200,margin:"auto",padding:24,lineHeight:1.8}}>
  <Link href="/workspace">← 返回工作台</Link><h1>每日任務</h1><p>{classroom?.name}</p>
  {process.env.PILOT_RETURN_DAYS_ENABLED==="true"&&<p><Link href={`/workspace/return-days?day=${day}`}>返校日專屬任務與設定 →</Link></p>}
  <form method="get"><label>日期 <input type="date" name="day" defaultValue={day} min="2000-01-01" max="2100-12-31" required style={{padding:8}}/></label> <button>查看任務</button></form>
  {params.notice==="saved"&&<p role="status">任務已儲存。</p>}{params.error&&<p role="alert">未能儲存，請確認模組、學期、上課日與出缺席，再重試；抄聯絡簿需先建立當日聯絡簿。</p>}
  <p>出缺席請到<Link href={`/workspace/attendance?day=${day}`}>獨立出缺席頁</Link>設定。請假者不計入當日任務分母，既有完成紀錄保留，不會自動改為完成。</p>
  {unavailable?<p role="alert">資料暫時無法載入，暫不顯示統計或操作，避免誤判。</p>:!enabled?<p>請先在工作台開啟「每日任務」。</p>:!term?<p>一般任務請先建立並啟用學期；返校日使用專屬入口。</p>:!school?<p>此日不是啟用學期的上課日，暫不開放一般任務。{process.env.PILOT_RETURN_DAYS_ENABLED==="true"?"返校日與交暑假作業請使用上方專屬入口。":"返校日專屬任務尚未啟用。"}獨立出缺席仍可使用。</p>:<>
   <p>{term.name}｜{day}。未確認出缺席者暫按出席統計。</p>
   {routineTasks.map(task=>{const progress=routineProgress(students?.data??[],checks?.data??[],attendance?.data??[],task.id);const copied=task.id==="contact_book_copied";const contactReady=Boolean(contact?.data);return <section key={task.id} style={{border:"1px solid #cbd5e1",borderRadius:10,padding:16,marginTop:16}}>
    <h2>{task.name} {progress.completed}／{progress.total}</h2>
    <p>{progress.total===0?"沒有需要統計的出席學生。":progress.missing.length?`未完成：${progress.missing.map(student=>student.name).join("、")}`:"全部完成。"}</p>
    {copied&&!contactReady&&<p>當日聯絡簿尚未建立，或「聯絡簿與作業」模組未開啟，不能新增抄寫完成；既有紀錄仍可取消。</p>}
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(min(100%,260px),1fr))",gap:12}}>{progress.roster.map(student=><form key={student.id} action={setRoutine} style={{border:"1px solid #cbd5e1",padding:12,borderRadius:8,overflowWrap:"anywhere"}}>
     <strong>{student.seat} 號 {student.name}</strong><p>{student.absent?"請假（不計入統計）":student.completed?"已完成":"未完成"}{student.absent&&student.completed?" · 保留原完成紀錄":""}</p>
     <input type="hidden" name="classId" value={classroom!.id}/><input type="hidden" name="termId" value={term.id}/><input type="hidden" name="studentId" value={student.id}/><input type="hidden" name="day" value={day}/><input type="hidden" name="task" value={task.id}/><input type="hidden" name="state" value={String(!student.completed)}/>
     {!student.absent&&(!copied||contactReady||student.completed)&&<Submit>{student.completed?"取消完成":"標記完成"}</Submit>}
    </form>)}</div>{!progress.roster.length&&<p>班級尚無使用中學生。</p>}
   </section>;})}
  </>}
  <p>{process.env.PILOT_ROUTINE_REWARDS_ENABLED==="true"?"目前只提供老師記錄；本班若另行啟用生活任務自動獎勵，今天新完成會依已確認規則給金幣與 XP，取消會回沖。過去／未來紀錄不發新獎勵，大屏尚未串接。":"目前只提供老師記錄；大屏自助、金幣與 XP 尚未串接，本次不發扣獎勵。"}</p>
 </main>;
}
