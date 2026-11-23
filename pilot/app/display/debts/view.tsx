import {displayText} from '../../../lib/display-settings';
import Link from 'next/link';
import {orderDebt,type DebtPreference} from '../../../lib/debt-order';
import {studentWork,type DebtAssignment,type DebtCheck} from '../../../lib/debts';
import {studentLearning,type PassportPlan,type PassportCheck,type ReadingCheck} from '../../../lib/learning-debts';
import {homeworkStatuses} from '../../../lib/homework';
import {type Term} from '../../../lib/calendar';
export type Data={preferences?:DebtPreference[];day:string;students:{id:string;seat:number;name:string}[];assignments:(DebtAssignment&{book_name:string})[];checks:DebtCheck[];learning:{term:Term|null;plans:PassportPlan[];passport_checks:PassportCheck[];reading_checks:ReadingCheck[];reading_enabled:boolean}};
export function DebtsView({data}:{data:Data}){
 const columns=data.students.length>9?5:Math.max(1,Math.min(3,data.students.length));
 return <main style={{height:'100%',boxSizing:'border-box',padding:'clamp(12px,1vw,24px)',display:'flex',flexDirection:'column',gap:12,background:'#071020',color:'#eef5ff',fontSize:displayText('clamp(14px,1vw,24px)')}}>
 <header style={{flexShrink:0,display:'flex',alignItems:'center',gap:24}}><Link href="/display" style={{color:'#a5d8ff'}}>白板首頁</Link><h1 style={{fontSize:displayText('clamp(24px,1.8vw,44px)'),margin:'4px 0'}}>待完成作業</h1></header>
 {!data.learning.term?<p>尚無啟用學期。</p>:<section aria-label="學生待完成卡片" style={{flex:1,minHeight:0,display:'grid',gridTemplateColumns:`repeat(${columns},minmax(0,1fr))`,gridAutoRows:'minmax(0,1fr)',gap:'clamp(8px,.8vw,20px)'}}>
 {data.students.map(s=>{
  const work=studentWork(data.assignments,data.checks,s.id,data.day),learning=studentLearning(data.learning.term!,data.day,s.id,data.learning.plans,data.learning.passport_checks,data.learning.reading_checks,data.learning.reading_enabled);
  const learningBlocked=learning.passports.length+learning.reading.length>0;
  const preference=data.preferences?.find(p=>p.student_id===s.id&&p.term_id===data.learning.term?.id);
  const pending=orderDebt([...work.unfinished.map(a=>({id:a.id,label:`${data.assignments.find(x=>x.id===a.id)?.book_name??''} ${a.content}`,status:homeworkStatuses.find(v=>v.id===a.status)?.name??'未交'})),...learning.passports.map(p=>({...p,status:'未完成'})),...learning.reading],preference?.ordered_keys);
  return <article key={s.id} style={{minHeight:0,minWidth:0,display:'flex',flexDirection:'column',gap:6,padding:'clamp(8px,.8vw,20px)',border:'1px solid #475569',borderRadius:12,background:'#111e33',overflowWrap:'anywhere'}}>
   <header style={{flexShrink:0}}><h2 style={{fontSize:displayText('clamp(16px,1.1vw,40px)'),margin:0}}>{s.seat} {s.name}</h2><p style={{margin:'4px 0 0',fontSize:displayText('clamp(12px,.7vw,28px)')}}><span style={{color:work.blocksBreak||learningBlocked?'#fda4af':'#6ee7b7'}}>{work.blocksBreak||learningBlocked?'不能下課':'可以下課'}</span> · <span style={{color:work.blocksShop||learningBlocked?'#fda4af':'#6ee7b7'}}>{work.blocksShop||learningBlocked?'商店暫停':'可以兌換'}</span></p></header>
   <div style={{flex:1,minHeight:0,overflowY:'auto',overscrollBehavior:'contain'}}>
   {pending[0]?<><div style={{padding:'clamp(6px,.5vw,14px)',borderRadius:8,background:'#25364d'}}><small style={{fontSize:displayText('clamp(11px,.6vw,24px)')}}>下一個先完成 · {pending[0].status}</small><p style={{fontSize:displayText('clamp(18px,1.5vw,56px)'),fontWeight:700,margin:'4px 0',lineHeight:1.2}}>{pending[0].label}</p></div>{preference?.show_more!==false&&pending.slice(1,3).map(p=><p key={p.id} style={{opacity:0.65,margin:'3px 0',fontSize:displayText('clamp(12px,.8vw,30px)')}}>{p.label} · {p.status}</p>)}</>:<p style={{color:'#6ee7b7'}}>所有需完成項目都已完成。</p>}
   </div>
   <p style={{flexShrink:0,margin:0,fontSize:displayText('clamp(12px,.7vw,28px)')}}>作業 {work.unfinished.length} 項 · 護照 {learning.passports.length} 項 · 閱讀／讀報 {learning.reading.length} 項</p>
  </article>;
 })}
 </section>}</main>;
}
