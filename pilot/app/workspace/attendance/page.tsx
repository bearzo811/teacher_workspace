import Link from "next/link";
import {redirect} from "next/navigation";
import {serverClient} from "../../../lib/supabase";
import {taipeiToday,validDate} from "../../../lib/calendar";
import {Submit} from "../submit";
import {setAttendance} from "./actions";
export const dynamic="force-dynamic";
export default async function Attendance({searchParams}:{searchParams:Promise<{day?:string;error?:string;notice?:string}>}) {
 if(process.env.PILOT_ATTENDANCE_ENABLED!=="true") redirect("/workspace");
 const params=await searchParams;const day=params.day&&validDate(params.day)?params.day:taipeiToday();
 const client=await serverClient();const {data:{user},error}=await client.auth.getUser();
 if(error||!user) redirect("/login");
 const classes=await client.from("pilot_classes").select("id,name");const classroom=classes.data?.[0];
 if(!classes.error&&!classroom) redirect("/workspace");
 const [students,attendance]=classroom?await Promise.all([
  client.from("pilot_students").select("id,seat,name").eq("class_id",classroom.id).is("deleted_at",null).order("seat"),
  client.from("pilot_attendance").select("student_id,absent").eq("class_id",classroom.id).eq("day",day),
 ]):[null,null];
 const unavailable=classes.error||students?.error||attendance?.error;
 const records=new Map((attendance?.data??[]).map(item=>[item.student_id,item.absent]));
 const roster=students?.data??[];const absent=roster.filter(student=>records.get(student.id)===true).length;
 return <main style={{maxWidth:1000,margin:"auto",padding:24,lineHeight:1.8}}>
  <Link href="/workspace">← 返回工作台</Link><h1>出缺席</h1><p>{classroom?.name}</p>
  <form method="get"><label>日期 <input type="date" name="day" defaultValue={day} min="2000-01-01" max="2100-12-31" required style={{padding:8}}/></label> <button>查看出缺席</button></form>
  {params.notice==="saved"&&<p role="status">出缺席已儲存。</p>}{params.error&&<p role="alert">未能儲存，請確認日期與學生仍在使用中，再重試。</p>}
  <p>出缺席獨立管理，返校日、學期外日期也可記錄，不需要開啟每日任務。未標記請假者暫按出席計算，但會明示是否已確認。</p>
  {unavailable?<p role="alert">資料暫時無法載入，暫不顯示出席人數或編輯表單，避免誤判。</p>:<>
   <p>{day}｜名冊 {roster.length} 人 · 請假 {absent} 人 · 暫按出席 {roster.length-absent} 人 · 未確認 {roster.filter(student=>!records.has(student.id)).length} 人</p>
   <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(min(100%,280px),1fr))",gap:12}}>{roster.map(student=><form key={student.id} action={setAttendance} style={{border:"1px solid #cbd5e1",borderRadius:8,padding:16}}>
    <strong>{student.seat} 號 {student.name}</strong><p>目前：{!records.has(student.id)?"未確認（暫按出席）":records.get(student.id)?"請假":"出席（已確認）"}</p>
    <input type="hidden" name="classId" value={classroom?.id}/><input type="hidden" name="studentId" value={student.id}/><input type="hidden" name="day" value={day}/>
    <label>出缺席 <select name="state" defaultValue={records.get(student.id)?"absent":"present"} style={{padding:8}}><option value="present">出席</option><option value="absent">請假</option></select></label> <Submit>儲存</Submit>
   </form>)}</div>{!roster.length&&<p>尚無使用中學生。</p>}
   <p>{process.env.PILOT_DUTY_SUBSTITUTES_ENABLED==='true'?'請假同學今天有已發布的值日工作時，大屏會顯示自願代班；不會自動指定代班者，老師確認完成後才發代班金幣。':'目前只保存出缺席，不會自動產生代班。'}出缺席不會自動免除作業；已接下的代班也不會因補登出席而消失，請到值日表的代班紀錄確認或取消。</p>
  </>}
 </main>;
}
