import Link from "next/link";
import {redirect} from "next/navigation";
import {serverClient} from "../../../lib/supabase";
import {moduleEnabled} from "../../../lib/modules";
import {taipeiToday,validDate,schoolDay,termWeek,type Term} from "../../../lib/calendar";
import {routineTasks,routineProgress} from "../../../lib/routines";
import {isHandedIn,validHomeworkStatus} from "../../../lib/homework";
export const dynamic="force-dynamic";
export default async function Today({searchParams}:{searchParams:Promise<{day?:string}>}){
 const params=await searchParams;const day=params.day&&validDate(params.day)?params.day:taipeiToday();const client=await serverClient();
 const {data:{user},error}=await client.auth.getUser();if(error||!user)redirect("/login");
 const classes=await client.from("pilot_classes").select("id,name,enabled_modules");const classroom=classes.data?.[0];if(!classes.error&&!classroom)redirect("/workspace");
 const homework=classroom&&moduleEnabled(classroom.enabled_modules,"homework")&&process.env.PILOT_HOMEWORK_CHECKS_ENABLED==="true";
 const routines=classroom&&moduleEnabled(classroom.enabled_modules,"routines")&&process.env.PILOT_ROUTINES_ENABLED==="true";
 const passports=classroom&&moduleEnabled(classroom.enabled_modules,"passport")&&process.env.PILOT_PASSPORTS_ENABLED==="true";
 const [students,terms,attendance,assignments]=classroom?await Promise.all([
  client.from("pilot_students").select("id,seat,name").eq("class_id",classroom.id).is("deleted_at",null).order("seat"),
  client.from("pilot_terms").select("*").eq("class_id",classroom.id).eq("active",true).maybeSingle(),
  process.env.PILOT_ATTENDANCE_ENABLED==="true"||routines?client.from("pilot_attendance").select("student_id,absent").eq("class_id",classroom.id).eq("day",day):Promise.resolve(null),
  homework?client.from("pilot_assignments").select("id,content,workbook_id",{count:"exact"}).eq("class_id",classroom.id).eq("due_day",day).eq("archived",false).order("id").range(0,999):Promise.resolve(null),
 ]):[null,null,null,null];
 const roster=students?.data??[];const term=terms?.data as Term|null;const week=term?termWeek(day,term):null;
 const [overrides,routineRows,plans,books]=classroom?await Promise.all([
  term?client.from("pilot_day_overrides").select("day,is_school_day,note").eq("term_id",term.id).eq("day",day):Promise.resolve(null),
  routines&&term?client.from("pilot_routine_checks").select("student_id,task_key,completed").eq("class_id",classroom.id).eq("term_id",term.id).eq("day",day):Promise.resolve(null),
  passports&&term&&week?client.from("pilot_passports").select("id,name").eq("class_id",classroom.id).eq("term_id",term.id).eq("archived",false).lte("first_week",week).gte("last_week",week):Promise.resolve(null),
  homework?client.from("pilot_workbooks").select("id,subject,name").eq("class_id",classroom.id):Promise.resolve(null),
 ]):[null,null,null,null];
 const homeworkRows:{assignment_id:string;student_id:string;status:string}[]=[];let homeworkError=false;const items=assignments?.data??[];
 if(homework&&classroom&&roster.length&&(assignments?.count??0)<=1000){
  for(let offset=0;offset<items.length;offset+=250){const batches=await Promise.all(Array.from({length:Math.ceil(Math.min(250,items.length-offset)/50)},(_,i)=>client.from("pilot_homework_checks").select("assignment_id,student_id,status").eq("class_id",classroom.id).in("assignment_id",items.slice(offset+i*50,offset+i*50+50).map(item=>item.id)).in("student_id",roster.map(student=>student.id))));if(batches.some(batch=>batch.error)){homeworkError=true;break;}homeworkRows.push(...batches.flatMap(batch=>batch.data??[]));}
 }
 const passportRows=passports&&classroom&&week&&plans?.data?.length&&roster.length?await client.from("pilot_passport_checks").select("passport_id,student_id,completed").eq("class_id",classroom.id).eq("week",week).in("passport_id",plans.data.map(plan=>plan.id)).in("student_id",roster.map(student=>student.id)):null;
 const coreError=classes.error||students?.error;const absent=new Set((attendance?.data??[]).filter(row=>row.absent).map(row=>row.student_id));const known=new Set((attendance?.data??[]).map(row=>row.student_id));
 const statusMap=new Map(homeworkRows.map(row=>[`${row.assignment_id}:${row.student_id}`,row.status]));const bookMap=new Map((books?.data??[]).map(book=>[book.id,`${book.subject}／${book.name}`]));
 const section={border:"1px solid #cbd5e1",borderRadius:10,padding:16,marginTop:16};
 return <main style={{maxWidth:1100,margin:"auto",padding:24,lineHeight:1.8}}>
  <Link href="/workspace">← 返回工作台</Link><h1>Today · 班級日常總覽</h1><p>{classroom?.name}</p>
  <form method="get"><label>日期 <input type="date" name="day" defaultValue={day} min="2000-01-01" max="2100-12-31" required/></label> <button>查看這一天</button></form>
  {coreError?<p role="alert">名冊或班級資料載入失敗，暫不顯示統計。</p>:<>
   <p>{day}｜{terms?.error?"學期載入失敗":term?`${term.name} · ${week?`第 ${week} 週`:"學期外"}`:"尚無啟用學期"}</p>
   {process.env.PILOT_ATTENDANCE_ENABLED==="true"&&<section style={section}><h2>出缺席</h2>{attendance?.error?<p role="alert">出缺席載入失敗，暫不顯示人數。</p>:<><p>名冊 {roster.length} 人 · 請假 {roster.filter(student=>absent.has(student.id)).length} 人 · 未確認 {roster.filter(student=>!known.has(student.id)).length} 人</p><p>請假：{roster.filter(student=>absent.has(student.id)).map(student=>student.name).join("、")||"目前沒有已標記請假的學生"}</p></>}<Link href={`/workspace/attendance?day=${day}`}>管理出缺席</Link></section>}
   {routines&&<section style={section}><h2>每日任務</h2>{terms?.error||overrides?.error||routineRows?.error||attendance?.error?<p role="alert">任務或行事曆資料載入失敗，暫不顯示完成統計。</p>:!term||!schoolDay(day,term,overrides?.data??[])?<p>此日不是啟用學期上課日；返校日專屬任務尚未移植。</p>:<>{routineTasks.map(task=>{const progress=routineProgress(roster,routineRows?.data??[],attendance?.data??[],task.id);return <div key={task.id}><strong>{task.name} {progress.completed}／{progress.total}</strong><p>{!progress.total?"沒有需要統計的出席學生。":progress.missing.length?`未完成：${progress.missing.map(student=>student.name).join("、")}`:"全部完成。"}</p></div>;})}<p>請假者不計入任務分母，未確認出缺席者暫按出席。</p></>}<Link href={`/workspace/routines?day=${day}`}>管理每日任務</Link></section>}
   {homework&&<section style={section}><h2>應繳作業</h2><p>依繳交日 {day} 查詢，不是這天聯絡簿新指派的作業。待確認、未訂正完成與已完成都算已交。</p>{assignments?.error||books?.error||homeworkError||(assignments?.count??0)>1000?<p role="alert">作業資料無法完整載入，暫不顯示名單。</p>:<>{!items.length&&<p>此日沒有應繳作業。</p>}{items.map(item=>{const missing=roster.filter(student=>{const status=statusMap.get(`${item.id}:${student.id}`)??"missing";return !validHomeworkStatus(status)||!isHandedIn(status);});return <div key={item.id}><strong>{bookMap.get(item.workbook_id)} {item.content} · 已交 {roster.length-missing.length}／{roster.length}</strong><p>{missing.length?`未交：${missing.map(student=>student.name).join("、")}`:"全班已交。"}</p></div>;})}</>}<Link href={`/workspace/homework?day=${day}`}>管理應繳作業</Link></section>}
   {passports&&<section style={section}><h2>本週護照</h2>{terms?.error||plans?.error||passportRows?.error?<p role="alert">護照資料載入失敗，暫不顯示名單。</p>:!week?<p>此日不在啟用學期內。</p>:<>{!(plans?.data?.length)&&<p>本週沒有使用中的護照項目。</p>}{plans?.data?.map(plan=>{const complete=new Set((passportRows?.data??[]).filter(row=>row.passport_id===plan.id&&row.completed).map(row=>row.student_id));const missing=roster.filter(student=>!complete.has(student.id));return <div key={plan.id}><strong>{plan.name} W{week} · 已完成 {roster.length-missing.length}／{roster.length}</strong><p>{missing.length?`未完成：${missing.map(student=>student.name).join("、")}`:"全班已完成。"}</p></div>;})}</>}<Link href="/workspace/passports">管理護照</Link></section>}
   <p>此頁只讀取已啟用功能，不修改紀錄或發扣獎勵；閱讀、值日與商店摘要將隨模組移植補上。</p>
  </>}
 </main>;
}
