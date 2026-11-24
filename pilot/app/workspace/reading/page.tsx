import Link from "next/link";
import {redirect} from "next/navigation";
import {serverClient} from "../../../lib/supabase";
import {moduleEnabled} from "../../../lib/modules";
import {taipeiToday,type Term} from "../../../lib/calendar";
import {readingKinds,readingStatuses,readingMonths,readingMonthOverdue} from "../../../lib/reading";
import {Submit} from "../submit";
import {setReading} from "./actions";
export const dynamic="force-dynamic";
export default async function Reading({searchParams}:{searchParams:Promise<{notice?:string;error?:string}>}){
 if(process.env.PILOT_READING_ENABLED!=="true")redirect("/workspace");
 const params=await searchParams;const client=await serverClient();const {data:{user},error}=await client.auth.getUser();if(error||!user)redirect("/login");
 const classes=await client.from("pilot_classes").select("id,name,enabled_modules");const classroom=classes.data?.[0];if(!classes.error&&!classroom)redirect("/workspace");const enabled=classroom&&moduleEnabled(classroom.enabled_modules,"reading");
 const terms=enabled?await client.from("pilot_terms").select("*").eq("class_id",classroom.id).eq("active",true).maybeSingle():null;const term=terms?.data as Term|null;
 const students=enabled&&term?await client.from("pilot_students").select("id,seat,name").eq("class_id",classroom.id).is("deleted_at",null).order("seat"):null;const roster=students?.data??[];
 const checks=enabled&&term&&roster.length?await client.from("pilot_reading_checks").select("student_id,kind,month,status").eq("class_id",classroom.id).eq("term_id",term.id).in("student_id",roster.map(student=>student.id)):null;
 const unavailable=classes.error||terms?.error||students?.error||checks?.error;const months=term?readingMonths(term.start_date,term.end_date):[];const today=taipeiToday();
 const statuses=new Map((checks?.data??[]).map(row=>[`${row.student_id}:${row.kind}:${row.month}`,row.status]));
 return <main style={{maxWidth:1400,margin:"auto",padding:24,lineHeight:1.8}}>
  <Link href="/workspace">← 返回工作台</Link><h1>閱讀／讀報</h1><p>{classroom?.name}</p>
  {params.notice==="saved"&&<p role="status">閱讀紀錄已儲存。</p>}{params.error&&<p role="alert">未能儲存，請確認模組、啟用學期、月份與學生仍可使用，再重試。</p>}
  {unavailable?<p role="alert">資料載入失敗，暫不顯示矩陣與操作，避免誤判。</p>:!enabled?<p>請先在工作台開啟「閱讀／讀報」。</p>:!term?<p>請先建立並啟用學期。</p>:<>
   <p>{term.name}｜依啟用學期日期自動列出月份，7、8 月除外，跨年包含 1 月。沿用閱讀三態：未開始、缺家長、已完成；當月未結束不算逾期。</p>
   {readingKinds.map(kind=><section key={kind.id} style={{border:"1px solid #cbd5e1",borderRadius:10,padding:16,marginTop:20}}><h2>{kind.name}</h2>
    <div style={{overflowX:"auto",maxWidth:"100%"}} role="region" aria-label={`${kind.name}完成矩陣`} tabIndex={0}><table style={{borderCollapse:"collapse",minWidth:"100%"}}><thead><tr><th style={{position:"sticky",left:0,background:"#f1f5f9",minWidth:150}}>座號／姓名</th>{months.map(month=><th key={month} style={{minWidth:180}}>{month.slice(0,7)}<br/><small>{readingMonthOverdue(month,today)?"月份已結束":"尚未到期"}</small></th>)}</tr></thead><tbody>{roster.map(student=><tr key={student.id}><th style={{position:"sticky",left:0,background:"#f1f5f9",whiteSpace:"nowrap",padding:8}}>{student.seat} {student.name}</th>{months.map(month=>{const status=statuses.get(`${student.id}:${kind.id}:${month}`)??"not_started";return <td key={month} style={{border:"1px solid #cbd5e1",padding:8}}><form action={setReading} aria-label={`${student.seat}號 ${student.name} ${month.slice(0,7)} ${kind.name}`}>
     <input type="hidden" name="classId" value={classroom!.id}/><input type="hidden" name="termId" value={term.id}/><input type="hidden" name="studentId" value={student.id}/><input type="hidden" name="month" value={month}/><input type="hidden" name="kind" value={kind.id}/>
     <label>狀態 <select name="status" defaultValue={status}>{readingStatuses.map(option=><option key={option.id} value={option.id}>{option.name}</option>)}</select></label><Submit>儲存</Submit>
    </form></td>;})}</tr>)}</tbody></table></div>
    {!months.length&&<p>此學期沒有需要追蹤的月份。</p>}{!roster.length&&<p>班級尚無使用中學生。</p>}
   </section>)}
  </>}
  <p>老師可修改閱讀狀態；已開放的配對白板僅能登記完成。{process.env.PILOT_READING_REWARDS_ENABLED==="true"?<>本班若<Link href="/workspace/rewards/reading-automation">另行確認啟用閱讀獎勵</Link>，新完成會給金幣、不給 XP，退回會回沖。</>:"目前不發扣金幣。"}月份結束後仍未完成才列入下課／商店的待完成判定；出缺席不自動改變閱讀狀態。到期明細可至<Link href="/workspace/debts">待完成總覽</Link>查看。</p>
 </main>;
}
