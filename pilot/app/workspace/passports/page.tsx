import Link from "next/link";
import {redirect} from "next/navigation";
import {serverClient} from "../../../lib/supabase";
import {moduleEnabled} from "../../../lib/modules";
import {taipeiToday,termWeek,type Term} from "../../../lib/calendar";
import {passportWeeks} from "../../../lib/passports";
import {Submit} from "../submit";
import {createPassport,archivePassport,setPassport} from "./actions";
export const dynamic="force-dynamic";
export default async function Passports({searchParams}:{searchParams:Promise<{notice?:string;error?:string}>}){
 if(process.env.PILOT_PASSPORTS_ENABLED!=="true")redirect("/workspace");
 const params=await searchParams;const client=await serverClient();const {data:{user},error}=await client.auth.getUser();if(error||!user)redirect("/login");
 const classes=await client.from("pilot_classes").select("id,name,enabled_modules");const classroom=classes.data?.[0];if(!classes.error&&!classroom)redirect("/workspace");
 const enabled=classroom&&moduleEnabled(classroom.enabled_modules,"passport");
 const terms=enabled?await client.from("pilot_terms").select("*").eq("class_id",classroom.id).eq("active",true).maybeSingle():null;const term=terms?.data as Term|null;
 const [plans,students]=enabled&&term?await Promise.all([
  client.from("pilot_passports").select("id,name,first_week,last_week,archived").eq("class_id",classroom.id).eq("term_id",term.id).order("name"),
  client.from("pilot_students").select("id,seat,name").eq("class_id",classroom.id).is("deleted_at",null).order("seat"),
 ]):[null,null];
 const roster=students?.data??[];const rows:{passport_id:string;student_id:string;week:number;completed:boolean}[]=[];let checkError=false;
 // Each plan has at most 25 weeks × 15 active students: no silent 1000-row truncation.
 for(let offset=0;enabled&&roster.length&&offset<(plans?.data?.length??0);offset+=5){
  const batches=await Promise.all((plans?.data??[]).slice(offset,offset+5).map(plan=>client.from("pilot_passport_checks").select("passport_id,student_id,week,completed").eq("class_id",classroom!.id).eq("passport_id",plan.id).in("student_id",roster.map(student=>student.id))));
  if(batches.some(result=>result.error)){checkError=true;break;}rows.push(...batches.flatMap(result=>result.data??[]));
 }
 const unavailable=classes.error||terms?.error||plans?.error||students?.error||checkError;const done=new Set(rows.filter(row=>row.completed).map(row=>`${row.passport_id}:${row.student_id}:${row.week}`));
 const maxWeek=term?Math.min(25,termWeek(term.end_date,term)??25):25;const current=term?termWeek(taipeiToday(),term):null;
 return <main style={{maxWidth:1400,margin:"auto",padding:24,lineHeight:1.8}}>
  <Link href="/workspace">← 返回工作台</Link><h1>護照</h1><p>{classroom?.name}</p>
  {params.notice==="saved"&&<p role="status">護照已儲存。</p>}{params.error&&<p role="alert">未能儲存，請確認模組、啟用學期、名稱是否重複及週次範圍，再重試。</p>}
  {unavailable?<p role="alert">資料載入失敗，暫不顯示完成狀態與操作，避免誤判。</p>:!enabled?<p>請先在工作台開啟「護照」。</p>:!term?<p>請先建立並啟用學期。</p>:<>
   <p>{term.name}｜{current?`目前第 ${current} 週`:"今天不在此學期期間"}。兩種狀態：未開始、已完成。可記錄提前完成的週次；本段不發扣金幣，也不影響下課或商店。</p>
   <details><summary>新增護照</summary><form action={createPassport} style={{display:"flex",flexWrap:"wrap",gap:12,alignItems:"end"}}>
    <input type="hidden" name="classId" value={classroom!.id}/><input type="hidden" name="termId" value={term.id}/>
    <label>名稱 <input name="name" required maxLength={60} placeholder="例如：國語護照"/></label><label>開始週 <input type="number" name="first" min={1} max={maxWeek} defaultValue={Math.min(3,maxWeek)} required style={{width:70}}/></label><label>結束週 <input type="number" name="last" min={1} max={maxWeek} defaultValue={Math.min(16,maxWeek)} required style={{width:70}}/></label><Submit>建立護照</Submit>
   </form><p>每學期最多保留 20 本（含停用）。週次限 1～{maxWeek}，建立後本階段不提供更改範圍，以免既有紀錄被隱藏；可停用並新增。</p></details>
   {!(plans?.data?.length)&&<p>尚未建立護照，名稱可依學校需求自行設定。</p>}
   {(plans?.data??[]).map(plan=>{const weeks=passportWeeks(plan.first_week,plan.last_week);return <section key={plan.id} style={{border:"1px solid #cbd5e1",borderRadius:10,padding:16,marginTop:20}}>
    <h2>{plan.name}{plan.archived?"（已停用）":""}</h2><p>第 {plan.first_week}～{plan.last_week} 週；{plan.archived?"目前僅供查看，復原後才可修改完成狀態。":"點選學生對應週次，可標記或取消完成。"}</p>
    <details><summary>{plan.archived?"復原護照":"停用護照"}</summary><form action={archivePassport}><input type="hidden" name="classId" value={classroom!.id}/><input type="hidden" name="passportId" value={plan.id}/><input type="hidden" name="state" value={String(!plan.archived)}/><label><input type="checkbox" name="confirm" value="yes" required/>確認{plan.archived?"復原":"停用，保留完成紀錄"}</label> <Submit>{plan.archived?"復原":"停用"}</Submit></form></details>
    <div style={{overflowX:"auto",maxWidth:"100%",marginTop:12}} role="region" aria-label={`${plan.name}完成矩陣`} tabIndex={0}><table style={{borderCollapse:"collapse",minWidth:"100%"}}><thead><tr><th style={{position:"sticky",left:0,background:"#f1f5f9",minWidth:150}}>座號／姓名</th>{weeks.map(week=><th key={week}>W{week}</th>)}</tr></thead><tbody>{roster.map(student=><tr key={student.id}><th style={{position:"sticky",left:0,background:"#f1f5f9",whiteSpace:"nowrap",padding:8}}>{student.seat} {student.name}</th>{weeks.map(week=>{const completed=done.has(`${plan.id}:${student.id}:${week}`);return <td key={week} style={{border:"1px solid #cbd5e1",padding:4,textAlign:"center"}}>{plan.archived?<span>{completed?"✓ 已完成":"未開始"}</span>:<form action={setPassport} aria-label={`${student.seat}號 ${student.name} 第${week}週`}><input type="hidden" name="classId" value={classroom!.id}/><input type="hidden" name="passportId" value={plan.id}/><input type="hidden" name="studentId" value={student.id}/><input type="hidden" name="week" value={week}/><input type="hidden" name="state" value={String(!completed)}/><Submit>{completed?"✓ 已完成":"未開始"}</Submit></form>}</td>;})}</tr>)}</tbody></table></div>
    {!roster.length&&<p>班級尚無使用中學生。</p>}
   </section>;})}
  </>}
  <p>此頁目前僅提供老師端記錄；學生大屏、下課／商店限制與獎勵結算尚未串接。出缺席不會自動變更護照狀態。未完成明細可至<Link href="/workspace/debts">待完成總覽</Link>查看。</p>
 </main>;
}
