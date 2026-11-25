import Link from 'next/link';
import {randomUUID} from 'node:crypto';
import {redirect} from 'next/navigation';
import {serverClient} from '../../../lib/supabase';
import {taipeiToday,validDate,type Term} from '../../../lib/calendar';
import {DutyPlanner,type DutyContext} from './planner';
export const dynamic='force-dynamic';
type Month={days:string[];assignments:{id:string;day:string;student_id:string;student_name:string;job_name:string}[]};
export default async function Duty({searchParams}:{searchParams:Promise<{term?:string;month?:string;from?:string;error?:string;notice?:string}>}){
 if(process.env.PILOT_DUTY_PLANNER_ENABLED!=='true')redirect('/workspace');
 const params=await searchParams,client=await serverClient(),{data:{user},error}=await client.auth.getUser();if(error||!user)redirect('/login');
 const rooms=await client.from('pilot_classes').select('id,name,enabled_modules'),room=rooms.data?.[0];if(!rooms.error&&!room)redirect('/workspace');
 const enabled=room?.enabled_modules.includes('duty');
 const terms=room&&enabled?await client.from('pilot_terms').select('*').eq('class_id',room.id).order('start_date',{ascending:false}):null;
 const list=(terms?.data??[]) as Term[],term=list.find(t=>t.id===params.term)??list.find(t=>t.active)??list[0],today=taipeiToday();
 const month=params.month&&validDate(params.month+'-01')?params.month:today.slice(0,7);
 const [latest,calendar]=room&&term?await Promise.all([
  client.from('pilot_duty_plans').select('revision').eq('class_id',room.id).eq('term_id',term.id).order('revision',{ascending:false}).limit(1),
  client.rpc('get_pilot_duty_month',{target_class:room.id,target_term:term.id,target_month:month+'-01'}),
 ]):[null,null];
 const tomorrow=new Date(Date.parse(today)+86400000).toISOString().slice(0,10),revision=latest?.data?.[0]?.revision??0;
 const first=params.from&&validDate(params.from)?params.from:revision?tomorrow>term!.start_date?tomorrow:term!.start_date:term?.start_date;
 const canPlan=!!term?.active&&!!first&&first>=term.start_date&&first<=term.end_date;
 const planning=canPlan&&room?await client.rpc('get_pilot_duty_planning',{target_class:room.id,target_term:term!.id,starts_on:first}):null;
 const unavailable=rooms.error||terms?.error||latest?.error||calendar?.error||planning?.error;
 const data=calendar?.data as Month|null,missing=data?.days.filter(day=>!data.assignments.some(a=>a.day===day))??[];
 return <main style={{maxWidth:1400,margin:'auto',padding:24,lineHeight:1.8}}><Link href="/workspace">← 返回工作台</Link><h1>值日表</h1><p>{room?.name}</p>{process.env.PILOT_DUTY_SUBSTITUTES_ENABLED==='true'&&<p><Link href="/workspace/duty/covers">自願代班確認與紀錄</Link></p>}
 {params.notice==='published'&&<p role="status">值日表已發布，原先排程與歷史仍保留。</p>}{params.error&&<p role="alert">{params.error==='changed'?'名冊或排程已更新，請重新載入並確認預覽後再發布。':'未能發布，請確認人力、行事曆與排程預覽後重試。'}</p>}
 {!enabled&&!unavailable?<p>請先在工作台開啟「值日工作」模組。</p>:unavailable?<p role="alert">值日資料無法完整讀取，暫不提供發布，請重新整理。</p>:!term?<p>請先建立學期。</p>:<><form method="get" style={{display:'flex',gap:12,flexWrap:'wrap',alignItems:'end'}}><label>學期 <select name="term" defaultValue={term.id}>{list.map(t=><option key={t.id} value={t.id}>{t.name}{t.active?'（啟用）':''}</option>)}</select></label><label>顯示月份 <input type="month" name="month" defaultValue={month} required/></label><button>查看月份</button></form>
 <h2>{month} 值日工作</h2>{missing.length>0&&<p role="alert">有 {missing.length} 個上課日尚無排程；若最近改了上課日，請檢查並重新預覽未來值日表。</p>}
 <div style={{overflowX:'auto'}}><table style={{width:'100%',borderCollapse:'collapse'}}><thead><tr><th>日期</th><th>工作分配</th></tr></thead><tbody>{data?.days.map(day=><tr key={day}><th style={{padding:12,verticalAlign:'top',whiteSpace:'nowrap'}}>{day}</th><td style={{padding:12,borderBottom:'1px solid #cbd5e1'}}>{data.assignments.some(a=>a.day===day)?Array.from(new Set(data.assignments.filter(a=>a.day===day).map(a=>a.student_id))).map(id=>{const rows=data.assignments.filter(a=>a.day===day&&a.student_id===id);return <div key={id}><strong>{rows[0].student_name}</strong>：{rows.map(a=>a.job_name).join('、')}</div>;}):'尚未排定'}</td></tr>)}</tbody></table></div>{!data?.days.length&&<p>本月在此學期內沒有上課日。</p>}
 {term.active&&<><h2>建立新版輪排</h2><p>首次發布可涵蓋整個學期；之後的新排程只能從明天或更晚套用，今天及過去的工作不會被重寫。</p><form method="get"><input type="hidden" name="term" value={term.id}/><input type="hidden" name="month" value={month}/><label>開始套用日期 <input name="from" type="date" min={revision?(tomorrow>term.start_date?tomorrow:term.start_date):term.start_date} max={term.end_date} defaultValue={first} required/></label> <button>準備輪排預覽</button></form>{planning?.data?<DutyPlanner key={`${term.id}:${revision}:${first}`} classroom={room!.id} context={planning.data as DutyContext} request={randomUUID()}/>:<p>此日期無法建立新排程，請調整套用日期。</p>}</>}
 </>}
 </main>;
}
