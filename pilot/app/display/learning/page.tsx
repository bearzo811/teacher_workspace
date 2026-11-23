import Link from 'next/link';
import {cookies} from 'next/headers';
import {redirect} from 'next/navigation';
import {displayClient,displayCookie} from '../../../lib/display';
import {passportWeeks} from '../../../lib/passports';
import {termWeek,type Term} from '../../../lib/calendar';
import {readingKinds,readingStatuses} from '../../../lib/reading';
export const dynamic='force-dynamic';
type Snapshot={day:string;term:Term|null;passport_enabled:boolean;reading_enabled:boolean;students:{id:string;seat:number;name:string}[];plans:{id:string;name:string;first_week:number;last_week:number}[];passport_checks:{passport_id:string;student_id:string;week:number;completed:boolean}[];months:string[];reading_checks:{student_id:string;kind:string;month:string;status:string}[]};
export default async function Learning({searchParams}:{searchParams:Promise<{student?:string;mode?:string}>}){
 if(process.env.PILOT_DISPLAY_LEARNING_ENABLED!=='true')redirect('/display');
 const params=await searchParams,token=(await cookies()).get(displayCookie)?.value;if(!token)redirect('/display/pair');
 const student=params.student&&/^[a-f0-9-]{36}$/i.test(params.student)?params.student:null;
 const result=await displayClient().rpc('get_pilot_display_learning',{device_token:token,selected_student:student});
 if(result.error)return <main style={{padding:32}}><h1>護照與閱讀暫時無法開啟</h1><Link href="/display/learning">重新選擇</Link> · <Link href="/display/pair">白板配對</Link></main>;
 const data=result.data as Snapshot,selected=data.students.find(s=>s.id===student),rows=selected?[selected]:data.students;
 const mode=params.mode==='reading'&&data.reading_enabled||!data.passport_enabled?'reading':'passport',week=data.term?termWeek(data.day,data.term):null;
 const base=(m:string,id?:string)=>`/display/learning?mode=${m}${id?`&student=${id}`:''}`;
 const cell={padding:'12px 14px',borderBottom:'1px solid #334155',textAlign:'center' as const};
 return <main style={{height:'100%',boxSizing:'border-box',padding:20,background:'#071020',color:'#eef5ff',display:'flex',flexDirection:'column',gap:16,fontSize:22}}>
 <header style={{flexShrink:0,display:'flex',gap:20,alignItems:'center',flexWrap:'wrap'}}><Link href="/display" style={{color:'#a5d8ff'}}>白板首頁</Link>{data.passport_enabled&&<Link href={base('passport',student??undefined)} style={{color:mode==='passport'?'#fbbf24':'#a5d8ff'}}>護照</Link>}{data.reading_enabled&&<Link href={base('reading',student??undefined)} style={{color:mode==='reading'?'#fbbf24':'#a5d8ff'}}>讀報與閱讀</Link>}<strong>{selected?`${selected.seat} 號 ${selected.name}`:'全班狀態'} {week?`· 第 ${week} 週`:''}</strong></header>
 <section style={{flex:1,minHeight:0,overflow:'auto',display:'flex',flexDirection:'column',gap:20}}>{!data.passport_enabled&&!data.reading_enabled?<p>本班未使用護照與閱讀。</p>:!data.term?<p>尚無啟用學期。</p>:mode==='passport'?<>{!data.plans.length&&<p>本學期沒有使用中的護照。</p>}{data.plans.map(plan=>{const weeks=passportWeeks(plan.first_week,plan.last_week).filter(w=>w<=(termWeek(data.term!.end_date,data.term!)??0));return <article key={plan.id}><h2>{plan.name}</h2><table style={{borderCollapse:'collapse',width:'100%'}}><thead><tr><th style={{...cell,textAlign:'left'}}>座號／姓名</th>{weeks.map(w=><th key={w} style={cell}>W{w}</th>)}</tr></thead><tbody>{rows.map(s=><tr key={s.id}><th style={{...cell,textAlign:'left',whiteSpace:'nowrap'}}>{s.seat} {s.name}</th>{weeks.map(w=>{const complete=data.passport_checks.some(c=>c.passport_id===plan.id&&c.student_id===s.id&&c.week===w&&c.completed);return <td key={w} style={{...cell,color:complete?'#6ee7b7':'#cbd5e1'}} aria-label={`第 ${w} 週${complete?'已完成':'未開始'}`}>{complete?'✓':'—'}</td>;})}</tr>)}</tbody></table></article>;})}</>:<>{readingKinds.map(kind=><article key={kind.id}><h2>{kind.name}</h2><table style={{borderCollapse:'collapse',width:'100%'}}><thead><tr><th style={{...cell,textAlign:'left'}}>座號／姓名</th>{data.months.map(month=><th key={month} style={cell}>{Number(month.slice(5,7))}月</th>)}</tr></thead><tbody>{rows.map(s=><tr key={s.id}><th style={{...cell,textAlign:'left',whiteSpace:'nowrap'}}>{s.seat} {s.name}</th>{data.months.map(month=>{const status=data.reading_checks.find(c=>c.student_id===s.id&&c.kind===kind.id&&c.month===month)?.status??'not_started';return <td key={month} style={{...cell,color:status==='completed'?'#6ee7b7':status==='missing_parent'?'#fbbf24':'#cbd5e1'}} aria-label={readingStatuses.find(v=>v.id===status)?.name}>{status==='completed'?'✓':status==='missing_parent'?'缺家長':'—'}</td>;})}</tr>)}</tbody></table></article>)}</>}</section>
 <footer style={{flexShrink:0,display:'flex',gap:10,flexWrap:'wrap'}}>{data.students.map(s=><Link key={s.id} href={base(mode,s.id===student?undefined:s.id)} style={{padding:'12px 18px',borderRadius:10,background:s.id===student?'#fbbf24':'#1e293b',color:s.id===student?'#111827':'#fff',textDecoration:'none'}}>{s.seat}</Link>)}</footer>
 </main>;
}
