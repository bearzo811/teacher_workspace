import Link from "next/link";
import {redirect} from "next/navigation";
import {serverClient} from "../../../../lib/supabase";
import {moduleEnabled} from "../../../../lib/modules";
import {taipeiToday,validDate} from "../../../../lib/calendar";
import {homeworkStatuses} from "../../../../lib/homework";
import {workbookProgress} from "../../../../lib/workbook-progress";
export const dynamic="force-dynamic";
export default async function Progress({searchParams}:{searchParams:Promise<{term?:string;book?:string;day?:string}>}){
 if(process.env.PILOT_HOMEWORK_CHECKS_ENABLED!=="true")redirect("/workspace");
 const params=await searchParams;const today=taipeiToday();const validDay=!params.day||(validDate(params.day)&&params.day>= "2000-01-01"&&params.day<=today);const day=params.day??today;
 const client=await serverClient();const {data:{user},error}=await client.auth.getUser();if(error||!user)redirect("/login");
 const classes=await client.from("pilot_classes").select("id,name,enabled_modules");const classroom=classes.data?.[0];if(!classes.error&&!classroom)redirect("/workspace");
 const enabled=classroom&&moduleEnabled(classroom.enabled_modules,"homework");
 const [terms,books,students]=enabled?await Promise.all([
  client.from("pilot_terms").select("id,name,active,start_date").eq("class_id",classroom.id).order("start_date",{ascending:false}),
  client.from("pilot_workbooks").select("id,subject,name,archived").eq("class_id",classroom.id).order("subject").order("name"),
  client.from("pilot_students").select("id,seat,name").eq("class_id",classroom.id).is("deleted_at",null).order("seat"),
 ]):[null,null,null];
 const term=params.term?terms?.data?.find(item=>item.id===params.term):terms?.data?.find(item=>item.active);
 const book=params.book?books?.data?.find(item=>item.id===params.book):books?.data?.find(item=>!item.archived);
 const selectionInvalid=Boolean((params.term&&!term)||(params.book&&!book)||!validDay);
 const assignments=enabled&&term&&book&&validDay?await client.from("pilot_assignments").select("id,content,contact_day,due_day,archived",{count:"exact"}).eq("class_id",classroom.id).eq("term_id",term.id).eq("workbook_id",book.id).eq("archived",false).lte("due_day",day).order("contact_day").order("id").range(0,999):null;
 const items=assignments?.data??[];const roster=students?.data??[];const checks:{assignment_id:string;student_id:string;status:string}[]=[];let checkError=false;
 if(enabled&&roster.length&&(assignments?.count??0)<=1000){for(let offset=0;offset<items.length;offset+=250){const batches=await Promise.all(Array.from({length:Math.ceil(Math.min(250,items.length-offset)/50)},(_,index)=>client.from("pilot_homework_checks").select("assignment_id,student_id,status").eq("class_id",classroom.id).in("assignment_id",items.slice(offset+index*50,offset+index*50+50).map(item=>item.id)).in("student_id",roster.map(student=>student.id))));if(batches.some(batch=>batch.error)){checkError=true;break;}checks.push(...batches.flatMap(batch=>batch.data??[]));}}
 const unavailable=classes.error||terms?.error||books?.error||students?.error||assignments?.error||checkError||(assignments?.count??0)>1000;
 const progress=workbookProgress(roster,items,checks,day);const sticky={position:"sticky" as const,background:"#f8fafc",zIndex:2};const cell={borderBottom:"1px solid #cbd5e1",padding:10,textAlign:"left" as const,overflowWrap:"anywhere" as const};
 return <main style={{maxWidth:1400,margin:"auto",padding:24,lineHeight:1.8}}><Link href="/workspace/homework">← 返回作業檢核</Link><h1>簿本完成進度</h1><p>{classroom?.name}</p>
 {unavailable?<p role="alert">無法完整載入進度，暫不顯示百分比。單本超過 1000 項時請選較早的統計日期。</p>:!enabled?<p>請先開啟聯絡簿與作業模組。</p>:<>
 <form method="get" style={{display:"flex",flexWrap:"wrap",gap:12}}><label>學期 <select name="term" defaultValue={term?.id??""} required><option value="" disabled>請選學期</option>{terms?.data?.map(item=><option key={item.id} value={item.id}>{item.name}{item.active?"（使用中）":"（歷史）"}</option>)}</select></label><label>簿本 <select name="book" defaultValue={book?.id??""} required><option value="" disabled>請選簿本</option>{books?.data?.map(item=><option key={item.id} value={item.id}>{item.subject}／{item.name}{item.archived?"（停用）":""}</option>)}</select></label><label>統計至 <input type="date" name="day" defaultValue={validDay?day:today} min="2000-01-01" max={today} required/></label><button>查看進度</button></form>
 {selectionInvalid?<p role="alert">所選日期、學期或簿本無效，未顯示其他資料。</p>:!term||!book?<p>請先建立學期與簿本。</p>:<>
 <h2>{book.subject}／{book.name} · 學生完成進度</h2><p>只統計此學期截至 {day} 已到繳交日且未移除的作業。完成率＝已完成訂正份數／應繳份數；待確認與未訂正完成算已交，但不算已完成。沒有應繳項目顯示「—」。</p>
 {!progress.items.length?<p>此範圍尚無應繳項目。</p>:!roster.length?<p>尚無使用中學生。</p>:<div role="region" aria-label="簿本學生完成進度表，可捲動" tabIndex={0} style={{overflow:"auto",maxHeight:"65vh",border:"1px solid #cbd5e1",position:"relative"}}><table style={{borderCollapse:"separate",borderSpacing:0,tableLayout:"fixed",width:326+progress.items.length*220}}><colgroup><col style={{width:64}}/><col style={{width:150}}/><col style={{width:112}}/>{progress.items.map(item=><col key={item.id} style={{width:220}}/>)}</colgroup><thead><tr><th style={{...cell,...sticky,top:0,left:0,zIndex:4}}>座號</th><th style={{...cell,...sticky,top:0,left:64,zIndex:4}}>姓名</th><th style={{...cell,...sticky,top:0,left:214,zIndex:4}}>完成率</th>{progress.items.map(item=><th key={item.id} style={{...cell,...sticky,top:0,zIndex:3}}>{item.content}<small style={{display:"block"}}>繳交：{item.due_day}</small></th>)}</tr></thead><tbody>{progress.rows.map(student=><tr key={student.id}><td style={{...cell,...sticky,left:0}}>{student.seat}</td><th scope="row" style={{...cell,...sticky,left:64}}>{student.name}</th><td style={{...cell,...sticky,left:214}}><strong>{student.percent===null?"—":`${student.percent}%`}</strong><small style={{display:"block"}}>{student.completed}／{student.total} 份</small></td>{student.statuses.map((status,index)=><td key={progress.items[index].id} style={cell}>{homeworkStatuses.find(item=>item.id===status)?.name}</td>)}</tr>)}</tbody></table></div>}
 </>}
 </>}
 </main>;
}
