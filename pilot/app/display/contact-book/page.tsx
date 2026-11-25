import {displayText} from '../../../lib/display-settings';
import Link from 'next/link';
import {cookies} from 'next/headers';
import {redirect} from 'next/navigation';
import {displayClient,displayCookie} from '../../../lib/display';
import {routineProgress,type RoutineCheck,type RoutineStudent} from '../../../lib/routines';
import {isHandedIn,validHomeworkStatus} from '../../../lib/homework';
import {randomUUID} from 'node:crypto';
import {Submit} from '../../workspace/submit';
import {submitHomework,completeRoutine} from './actions';
import {SubstitutePanel,type SubstituteSnapshot} from './substitutes';
export const dynamic='force-dynamic';
type Snapshot={day:string;week:number|null;class_name:string;school_day:boolean;return_label:string|null;contact_exists:boolean;notes:string;homework_enabled:boolean;routines_enabled:boolean;students:RoutineStudent[];attendance:{student_id:string;absent:boolean}[];routine_checks:RoutineCheck[];return_checks:RoutineCheck[];assigned:{id:string;name:string;content:string;due_day:string}[];due:{id:string;name:string;content:string;contact_day:string}[];homework_checks:{assignment_id:string;student_id:string;status:string}[]};
export default async function Contact({searchParams}:{searchParams:Promise<{student?:string;notice?:string;error?:string;assignment?:string;task?:string}>}){
 if(process.env.PILOT_DISPLAY_CONTACT_ENABLED!=='true')redirect('/display');
 const params=await searchParams,token=(await cookies()).get(displayCookie)?.value;if(!token)redirect('/display/pair');
 const student=params.student&&/^[a-f0-9-]{36}$/i.test(params.student)?params.student:null;
 const [response,coverResponse]=await Promise.all([
  displayClient().rpc('get_pilot_display_contact',{device_token:token,selected_student:student}),
  process.env.PILOT_DUTY_SUBSTITUTES_ENABLED==='true'?displayClient().rpc('get_pilot_display_substitutes',{device_token:token}):Promise.resolve(null),
 ]);
 if(response.error)return <main style={{padding:32}}><h1>聯絡簿暫時無法開啟</h1><p>請重新選擇學生，或請老師確認白板授權。</p><Link href="/display/contact-book">重新選擇</Link> · <Link href="/display/pair">白板配對</Link></main>;
 const data=response.data as Snapshot,selected=data.students.find(s=>s.id===student),isReturn=!!data.return_label;
 const tasks=isReturn?[{id:'morning_cleaning',name:'上午打掃'},{id:'summer_homework_submitted',name:'交暑假作業'}]:[{id:'morning_cleaning',name:'上午打掃'},{id:'contact_book_copied',name:'抄聯絡簿'}];
 const checks=isReturn?data.return_checks:data.routine_checks;
 const handed=(id:string,assignment:string)=>{const state=data.homework_checks.find(c=>c.student_id===id&&c.assignment_id===assignment)?.status??'missing';return validHomeworkStatus(state)&&isHandedIn(state);};
 const missing=data.students.filter(s=>data.due.some(a=>!handed(s.id,a.id)));
 const card={border:'1px solid #475569',borderRadius:12,padding:20,background:'#111e33',overflowWrap:'anywhere' as const};
 return <main style={{height:'100%',boxSizing:'border-box',padding:20,display:'flex',flexDirection:'column',gap:16,background:'#071020',color:'#eef5ff',fontSize:displayText(22)}}>
 <section style={{display:'grid',gridTemplateColumns:'minmax(0,1fr) minmax(0,1fr)',gap:16,flex:1,minHeight:0}}>
 <div style={{minHeight:0,overflowY:'auto',overscrollBehavior:'contain',display:'flex',flexDirection:'column',gap:12}}><article style={{...card,background:'#123f30',border:'6px solid #80501f',flex:1}}><h1>{data.day} {data.week?`第 ${data.week} 週`:data.return_label??''}</h1>{!data.homework_enabled?<p>本班未使用聯絡簿。</p>:<>{!data.contact_exists&&!data.assigned.length&&<p>尚未填寫</p>}<ol>{data.assigned.map(a=><li key={a.id} style={{marginBottom:16}}>{a.name} {a.content}</li>)}</ol><p style={{whiteSpace:'pre-wrap'}}>{data.notes}</p></>}</article><>{coverResponse?.error?<p role="alert">代班資料暫時無法載入。</p>:coverResponse?.data?<SubstitutePanel data={coverResponse.data as SubstituteSnapshot} student={student} absent={data.attendance.some(a=>a.student_id===student&&a.absent)}/>:null}</></div>
 <section style={{minHeight:0,overflowY:'auto',display:'flex',flexDirection:'column',gap:16}}><h2 style={{margin:0}}>{selected?`${selected.seat} 號 ${selected.name} · 個人進度`:'今日進度'}</h2>
 {selected&&params.notice==='submitted'&&data.due.some(a=>a.id===params.assignment&&handed(selected.id,a.id))&&<p role="status" style={{color:'#6ee7b7'}}>已收到繳交紀錄，請等老師檢查。</p>}
 {selected&&params.notice==='routine'&&checks.some(c=>c.student_id===selected.id&&c.task_key===params.task&&c.completed)&&<p role="status" style={{color:'#6ee7b7'}}>已登記完成。</p>}
 {selected&&params.notice==='cover'&&<p role="status" style={{color:'#6ee7b7'}}>已接下代班，完成後請老師確認才會發放金幣。</p>}
 {params.error&&<p role="alert" style={{color:'#fda4af'}}>未能登記繳交，請重新整理並確認今天應繳項目，或請老師協助。</p>}
 {data.routines_enabled&&(data.school_day||isReturn)&&tasks.map(task=>{const progress=routineProgress(data.students,checks,data.attendance,task.id),done=checks.some(c=>c.student_id===student&&c.task_key===task.id&&c.completed),unavailable=task.id==='contact_book_copied'&&!data.contact_exists;return <article key={task.id} style={card}><h3 style={{marginTop:0}}>{task.name} {selected?'':`${progress.completed}／${progress.total}`}</h3>{unavailable?<p>今日聯絡簿尚未建立。</p>:selected?<p>{data.attendance.some(a=>a.student_id===student&&a.absent)?'今天請假':done?'已完成':'尚未完成'}</p>:<p style={{whiteSpace:'normal'}}>{progress.missing.length?`未完成：${progress.missing.map(s=>s.name).join('、')}`:'全部完成'}</p>}{selected&&process.env.PILOT_DISPLAY_ROUTINES_ENABLED==='true'&&!done&&!unavailable&&!data.attendance.some(a=>a.student_id===selected.id&&a.absent)&&<form action={completeRoutine}><input type="hidden" name="student" value={selected.id}/><input type="hidden" name="task" value={task.id}/><input type="hidden" name="request" value={randomUUID()}/><Submit pendingLabel="登記完成中…" fontSize={displayText(22)}>我完成了</Submit></form>}</article>;})}
 {data.routines_enabled&&!data.school_day&&!isReturn&&<p>今天沒有上課日或返校日任務。</p>}
 {data.homework_enabled&&<article style={card}><h3 style={{marginTop:0}}>今日應繳作業 {selected?'':`${data.students.length-missing.length}／${data.students.length}`}</h3>{!data.due.length?<p>今天沒有應繳作業。</p>:selected?data.due.map(a=><div key={a.id}><p>{handed(selected.id,a.id)?'已交':'未交'} · {a.name} {a.content}</p>{process.env.PILOT_DISPLAY_HOMEWORK_SUBMIT_ENABLED==='true'&&!handed(selected.id,a.id)&&data.school_day&&!data.attendance.some(r=>r.student_id===selected.id&&r.absent)&&<form action={submitHomework}><input type="hidden" name="student" value={selected.id}/><input type="hidden" name="assignment" value={a.id}/><input type="hidden" name="request" value={randomUUID()}/><Submit pendingLabel="登記繳交中…" fontSize={displayText(22)}>我已交出作業</Submit></form>}</div>):<p>{missing.length?`未交：${missing.map(s=>s.name).join('、')}`:'全班已交'}</p>}</article>}
 </section></section>
 <footer style={{flexShrink:0,display:'flex',alignItems:'center',gap:12,flexWrap:'wrap'}}><Link href="/display" style={{color:'#a5d8ff'}}>白板首頁</Link>{data.students.map(s=><Link key={s.id} href={s.id===student?'/display/contact-book':`/display/contact-book?student=${s.id}`} style={{background:s.id===student?'#fbbf24':'#1e293b',color:s.id===student?'#111827':'#fff',padding:'12px 18px',borderRadius:10,textDecoration:'none',fontSize:displayText(24)}}>{s.seat}</Link>)}</footer>
 </main>;
}
