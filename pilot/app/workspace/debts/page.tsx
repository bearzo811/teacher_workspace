import Link from "next/link";
import {redirect} from "next/navigation";
import {serverClient} from "../../../lib/supabase";
import {moduleEnabled} from "../../../lib/modules";
import {taipeiToday,validDate,type Term} from "../../../lib/calendar";
import {studentWork,type DebtAssignment,type DebtCheck} from "../../../lib/debts";
import {homeworkStatuses} from "../../../lib/homework";
import {studentLearning,type PassportPlan,type PassportCheck,type ReadingCheck} from "../../../lib/learning-debts";
export const dynamic="force-dynamic";
export default async function Debts({searchParams}:{searchParams:Promise<{term?:string;from?:string;day?:string}>}) {
 if(![process.env.PILOT_HOMEWORK_CHECKS_ENABLED,process.env.PILOT_PASSPORTS_ENABLED,process.env.PILOT_READING_ENABLED].includes("true")) redirect("/workspace");
 const params=await searchParams;const today=taipeiToday();const cutoff=params.day&&validDate(params.day)?params.day:today;
 const client=await serverClient();const {data:{user},error}=await client.auth.getUser();
 if(error||!user) redirect("/login");
 const classes=await client.from("pilot_classes").select("id,name,enabled_modules");const classroom=classes.data?.[0];
 if(!classes.error&&!classroom) redirect("/workspace");
 const homeworkEnabled=classroom&&moduleEnabled(classroom.enabled_modules,"homework")&&process.env.PILOT_HOMEWORK_CHECKS_ENABLED==="true";
 const passportEnabled=classroom&&moduleEnabled(classroom.enabled_modules,"passport")&&process.env.PILOT_PASSPORTS_ENABLED==="true";
 const readingEnabled=classroom&&moduleEnabled(classroom.enabled_modules,"reading")&&process.env.PILOT_READING_ENABLED==="true";
 const enabled=homeworkEnabled||passportEnabled||readingEnabled;
 const terms=enabled?await client.from("pilot_terms").select("*").eq("class_id",classroom.id).order("start_date",{ascending:false}):null;
 const list=(terms?.data??[]) as Term[];const term=list.find(item=>item.id===params.term)??list.find(item=>item.active)??list[0];
 const from=params.from&&validDate(params.from)?params.from:term?.start_date??today;
 const invalid=from>cutoff;
 const [assignments,students,books]=enabled&&term&&!invalid?await Promise.all([
  homeworkEnabled?client.from("pilot_assignments").select("id,content,contact_day,due_day,workbook_id,blocks_break,blocks_shop",{count:"exact"}).eq("class_id",classroom!.id).eq("term_id",term.id).eq("archived",false).gte("due_day",from).lte("due_day",cutoff).order("contact_day",{ascending:false}).order("id").range(0,999):Promise.resolve(null),
  client.from("pilot_students").select("id,seat,name").eq("class_id",classroom.id).is("deleted_at",null).order("seat"),
  homeworkEnabled?client.from("pilot_workbooks").select("id,subject,name").eq("class_id",classroom!.id):Promise.resolve(null),
 ]):[null,null,null];
 const tooMany=(assignments?.count??0)>1000;
 const items=(assignments?.data??[]) as DebtAssignment[];
 const ids=items.map(item=>item.id);const studentIds=(students?.data??[]).map(student=>student.id);
 const checkRows:DebtCheck[]=[];let checkError=false;
 // Bound concurrent requests and rows per query; archived student histories are not loaded.
 if(enabled&&!tooMany&&studentIds.length) {
  for(let offset=0;offset<ids.length;offset+=250) {
   const results=await Promise.all(Array.from({length:Math.ceil(Math.min(250,ids.length-offset)/50)},(_,index)=>client.from("pilot_homework_checks").select("assignment_id,student_id,status").eq("class_id",classroom.id).in("assignment_id",ids.slice(offset+index*50,offset+index*50+50)).in("student_id",studentIds)));
   if(results.some(result=>result.error)) {checkError=true;break;}
   checkRows.push(...results.flatMap(result=>result.data??[]));
  }
 }
 const plans=passportEnabled&&term&&classroom?await client.from("pilot_passports").select("id,name,first_week,last_week,archived").eq("class_id",classroom.id).eq("term_id",term.id).eq("archived",false):null;
 const passportRows:PassportCheck[]=[];let passportError=false;
 for(let offset=0;classroom&&studentIds.length&&offset<(plans?.data?.length??0);offset+=5){const results=await Promise.all((plans?.data??[]).slice(offset,offset+5).map(plan=>client.from("pilot_passport_checks").select("passport_id,student_id,week,completed").eq("class_id",classroom.id).eq("passport_id",plan.id).in("student_id",studentIds)));if(results.some(result=>result.error)){passportError=true;break;}passportRows.push(...results.flatMap(result=>result.data??[]));}
 const readingRows=readingEnabled&&term&&classroom&&studentIds.length?await client.from("pilot_reading_checks").select("student_id,kind,month,status").eq("class_id",classroom.id).eq("term_id",term.id).in("student_id",studentIds):null;
 const unavailable=classes.error||terms?.error||assignments?.error||students?.error||books?.error||checkError||plans?.error||passportError||readingRows?.error;
 const bookMap=new Map((books?.data??[]).map(book=>[book.id,`${book.subject}／${book.name}`]));
 const label=(item:DebtAssignment)=>`${bookMap.get(item.workbook_id)??"簿本"} ${item.content}`;
 return <main style={{maxWidth:1400,margin:"auto",padding:24,lineHeight:1.8}}>
  <Link href="/workspace">← 返回工作台</Link><h1>待完成作業總覽</h1><p>{classroom?.name}</p>
  {!enabled&&!unavailable&&<p>請先在工作台開啟「聯絡簿與作業」、「護照」或「閱讀／讀報」。</p>}
  {enabled&&<form method="get" style={{display:"flex",flexWrap:"wrap",gap:12,alignItems:"end"}}>
   <label>學期<br/><select name="term" defaultValue={term?.id} style={{padding:8,maxWidth:"100%"}}>{list.map(item=><option key={item.id} value={item.id}>{item.name}{item.active?"（啟用）":""}</option>)}</select></label>
   <label>繳交日起<br/><input type="date" name="from" defaultValue={from} required style={{padding:8}}/></label>
   <label>截至繳交日<br/><input type="date" name="day" defaultValue={cutoff} max={today} required style={{padding:8}}/></label><button>查看總覽</button>
  </form>}
  {unavailable?<p role="alert">資料載入失敗，暫不顯示名單或可下課判定，請重新整理。</p>:invalid?<p role="alert">開始日不能晚於截止日。</p>:cutoff>today?<p role="alert">請選今天或更早的截止日，尚未到期的作業不列為待完成。</p>:tooMany?<p role="alert">此範圍超過 1000 項作業，請縮短日期範圍；為避免漏列，暫不顯示學生判定。</p>:enabled&&!term?<p>請先建立學期。</p>:enabled&&term?<>
   <p>範圍：{term.name}，作業繳交日 {from}～{cutoff}；護照列至截止日當週，閱讀／讀報僅列截止日前已結束的月份。待確認及未訂正完成已算交出，但尚未完成；下課／商店標籤目前僅依所選作業設定提示，尚未實際限制大屏或商店。</p>
   <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(min(100%,320px),1fr))",gap:16,marginTop:20}}>
    {(students?.data??[]).map(student=>{const work=studentWork(items,checkRows,student.id,cutoff);const learning=studentLearning(term,cutoff,student.id,(plans?.data??[]) as PassportPlan[],passportRows,(readingRows?.data??[]) as ReadingCheck[],Boolean(readingEnabled));return <article key={student.id} style={{border:"1px solid #cbd5e1",borderRadius:12,padding:16,overflowWrap:"anywhere"}}>
     <h2>{student.seat} 號 {student.name}</h2><p><Link href={`/workspace/debts/print?${new URLSearchParams({student:student.id,term:term.id,from,day:cutoff})}`}>列印個人待完成清單</Link></p>{homeworkEnabled&&<p><strong>{work.blocksBreak?"不能下課":"可以下課"}</strong> · <strong>{work.blocksShop?"商店暫停":"可以兌換"}</strong>（僅所選作業，不含下列護照／閱讀）</p>}
     {homeworkEnabled&&(work.unfinished.length?<><p>下一個先完成</p><div style={{fontSize:24,fontWeight:700}}>{label(work.unfinished[0])}</div><p>{homeworkStatuses.find(item=>item.id===work.unfinished[0].status)?.name} · 聯絡簿 {work.unfinished[0].contact_day}</p>
      {work.unfinished.slice(1,3).map(item=><p key={item.id} style={{opacity:0.75}}>{label(item)} · {homeworkStatuses.find(option=>option.id===item.status)?.name}</p>)}</>:<p>所選範圍的作業都已完成。</p>)}
     {homeworkEnabled&&<p>未交 {work.missing} 項 · 待確認 {work.pending} 項 · 未訂正完成 {work.correction} 項</p>}
     {passportEnabled&&<details open><summary>護照尚待完成 {learning.passports.length} 項</summary>{learning.passports.length?<ul>{learning.passports.map(item=><li key={item.id}>{item.label}</li>)}</ul>:<p>此範圍沒有需列出的護照未完成項目。</p>}{term.active?<Link href="/workspace/passports">前往護照</Link>:<p>歷史學期目前僅供查閱。</p>}</details>}
     {readingEnabled&&<details open><summary>閱讀／讀報到期未完成 {learning.reading.length} 項</summary>{learning.reading.length?<ul>{learning.reading.map(item=><li key={item.id}>{item.label} · {item.status}</li>)}</ul>:<p>已結束月份沒有未完成項目；尚未到期月份不列入。</p>}{term.active?<Link href="/workspace/reading">前往閱讀／讀報</Link>:<p>歷史學期目前僅供查閱。</p>}</details>}
     {homeworkEnabled&&<details><summary>全部作業與狀態（{work.all.length}）</summary><ul>{work.all.map(item=><li key={item.id}>{label(item)} · {homeworkStatuses.find(option=>option.id===item.status)?.name}<br/>聯絡簿 {item.contact_day} · 繳交 {item.due_day} · <Link href={`/workspace/homework?day=${item.due_day}`}>前往檢核</Link></li>)}</ul></details>}
    </article>;})}
   </div>{!(students?.data?.length)&&<p>班級尚無使用中學生。</p>}
  </>:null}
 </main>;
}
