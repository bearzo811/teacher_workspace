import Link from "next/link";
import {redirect} from "next/navigation";
import {serverClient} from "../../../../lib/supabase";
import {moduleEnabled} from "../../../../lib/modules";
import {taipeiToday,type Term} from "../../../../lib/calendar";
import {validPrintScope,checklistRows} from "../../../../lib/debt-print";
import {studentLearning,type PassportPlan} from "../../../../lib/learning-debts";
import {studentWork,type DebtAssignment,type DebtCheck} from "../../../../lib/debts";
import {homeworkStatuses} from "../../../../lib/homework";
import {PrintButton} from "./print-button";
export const dynamic="force-dynamic";
export default async function DebtPrint({searchParams}:{searchParams:Promise<{student?:string;term?:string;from?:string;day?:string}>}) {
 if(![process.env.PILOT_HOMEWORK_CHECKS_ENABLED,process.env.PILOT_PASSPORTS_ENABLED,process.env.PILOT_READING_ENABLED].includes("true")) redirect("/workspace");
 const params=await searchParams;const today=taipeiToday();
 const valid=validPrintScope(params,today);
 const client=await serverClient();const {data:{user},error}=await client.auth.getUser();
 if(error||!user) redirect("/login");
 const classes=await client.from("pilot_classes").select("id,name,enabled_modules");const classroom=classes.data?.[0];
 const homework=classroom&&moduleEnabled(classroom.enabled_modules,"homework")&&process.env.PILOT_HOMEWORK_CHECKS_ENABLED==="true";
 const passport=classroom&&moduleEnabled(classroom.enabled_modules,"passport")&&process.env.PILOT_PASSPORTS_ENABLED==="true";
 const reading=classroom&&moduleEnabled(classroom.enabled_modules,"reading")&&process.env.PILOT_READING_ENABLED==="true";
 const enabled=homework||passport||reading;
 const [student,term,assignments,books]=valid&&enabled?await Promise.all([
  client.from("pilot_students").select("id,seat,name").eq("class_id",classroom.id).eq("id",params.student!).is("deleted_at",null).maybeSingle(),
  client.from("pilot_terms").select("*").eq("class_id",classroom.id).eq("id",params.term!).maybeSingle(),
  homework?client.from("pilot_assignments").select("id,content,contact_day,due_day,workbook_id,blocks_break,blocks_shop",{count:"exact"}).eq("class_id",classroom.id).eq("term_id",params.term!).eq("archived",false).gte("due_day",params.from!).lte("due_day",params.day!).order("contact_day",{ascending:false}).order("id").range(0,999):Promise.resolve(null),
  homework?client.from("pilot_workbooks").select("id,subject,name").eq("class_id",classroom.id):Promise.resolve(null),
 ]):[null,null,null,null];
 const tooMany=(assignments?.count??0)>1000;const items=(assignments?.data??[]) as DebtAssignment[];
 const checks:DebtCheck[]=[];let checkError=false;
 if(student?.data&&term?.data&&!tooMany&&!assignments?.error) {
  // Single-student batches stay below PostgREST's row limit.
  for(let offset=0;offset<items.length;offset+=250){
   const result=await client.from("pilot_homework_checks").select("assignment_id,student_id,status").eq("class_id",classroom!.id).eq("student_id",student.data.id).in("assignment_id",items.slice(offset,offset+250).map(item=>item.id));
   if(result.error){checkError=true;break;}checks.push(...(result.data??[]));
  }
 }
 const plans=passport&&student?.data&&term?.data?await client.from("pilot_passports").select("id,name,first_week,last_week,archived").eq("class_id",classroom!.id).eq("term_id",term.data.id).eq("archived",false):null;
 // A single student: at most 20 plans × 25 weeks, and 22 reading records per term.
 const [passportChecks,readingChecks]=student?.data&&term?.data?await Promise.all([
  plans?.data?.length?client.from("pilot_passport_checks").select("passport_id,student_id,week,completed").eq("class_id",classroom!.id).eq("student_id",student.data.id).in("passport_id",plans.data.map(plan=>plan.id)):Promise.resolve(null),
  reading?client.from("pilot_reading_checks").select("student_id,kind,month,status").eq("class_id",classroom!.id).eq("student_id",student.data.id).eq("term_id",term.data.id):Promise.resolve(null),
 ]):[null,null];
 const unavailable=classes.error||student?.error||term?.error||assignments?.error||books?.error||checkError||plans?.error||passportChecks?.error||readingChecks?.error;
 const ready=valid&&enabled&&student?.data&&term?.data&&!unavailable&&!tooMany;
 const work=ready?studentWork(items,checks,student!.data!.id,params.day!):null;
 const bookMap=new Map((books?.data??[]).map(book=>[book.id,`${book.subject}／${book.name}`]));
 const learning=ready?studentLearning(term!.data as Term,params.day!,student!.data!.id,(plans?.data??[]) as PassportPlan[],passportChecks?.data??[],readingChecks?.data??[],Boolean(reading)):{passports:[],reading:[]};
 const rows=checklistRows((work?.unfinished??[]).map(item=>({id:item.id,label:`${bookMap.get(item.workbook_id)??"簿本"} ${item.content}`,status:homeworkStatuses.find(status=>status.id===item.status)?.name??"未交"})),learning);
 const back=valid?`/workspace/debts?${new URLSearchParams({term:params.term!,from:params.from!,day:params.day!})}`:"/workspace/debts";
 return <main className="debt-print" style={{maxWidth:800,margin:"auto",padding:24,lineHeight:1.6}}>
  <style>{`@page{size:A4;margin:12mm} .debt-print table{width:100%;border-collapse:collapse;table-layout:fixed}.debt-print th,.debt-print td{border:1px solid #777;padding:8px;overflow-wrap:anywhere;text-align:left}.debt-print thead{display:table-header-group}.debt-print tr{break-inside:avoid}.debt-print .check{width:48px;text-align:center}.debt-print .state{width:100px}@media print{body{background:white!important;color:black!important}.debt-print{max-width:none!important;padding:0!important;margin:0!important;font-size:12pt}.no-print{display:none!important}.debt-print h1{font-size:18pt}}`}</style>
  <nav className="no-print"><Link href={back}>← 返回所選總覽</Link>{ready&&<> · <PrintButton/></>}</nav>
  <h1>作業與學習自主檢核表</h1>
  {unavailable?<p role="alert">資料載入失敗，暫不產生清單，請重新整理。</p>:!ready?<p role="alert">{tooMany?"範圍超過 1000 項，請返回總覽縮短日期範圍。":"無法產生清單，請從總覽重新選擇有效學生、學期及日期，並確認相關模組已開啟。"}</p>:<>
   <p>{classroom?.name}｜{student!.data!.seat} 號 {student!.data!.name}<br/>{term!.data!.name}｜繳交日範圍 {params.from}～{params.day}</p>
   <p>僅列已啟用模組：所選繳交日範圍作業、截止日當週以前護照、月份已結束的閱讀／讀報。</p>
   {rows.length?<table><thead><tr><th>待完成項目</th><th className="state">目前狀態</th><th className="check">自查</th></tr></thead><tbody>{rows.map(item=><tr key={item.id}><td>{item.label}</td><td>{item.status}</td><td className="check">□</td></tr>)}</tbody></table>:<p>所選範圍與已啟用模組沒有待完成項目。</p>}
  </>}
 </main>;
}
