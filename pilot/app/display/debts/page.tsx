import Link from 'next/link';
import {cookies} from 'next/headers';
import {redirect} from 'next/navigation';
import {displayClient,displayCookie} from '../../../lib/display';
import {studentWork,type DebtAssignment,type DebtCheck} from '../../../lib/debts';
import {studentLearning,type PassportPlan,type PassportCheck,type ReadingCheck} from '../../../lib/learning-debts';
import {homeworkStatuses} from '../../../lib/homework';
import {type Term} from '../../../lib/calendar';
export const dynamic='force-dynamic';
type Data={day:string;students:{id:string;seat:number;name:string}[];assignments:(DebtAssignment&{book_name:string})[];checks:DebtCheck[];learning:{term:Term|null;plans:PassportPlan[];passport_checks:PassportCheck[];reading_checks:ReadingCheck[];reading_enabled:boolean}};
export default async function Debts(){
 if(process.env.PILOT_DISPLAY_OVERVIEWS_ENABLED!=='true')redirect('/display');
 const token=(await cookies()).get(displayCookie)?.value;if(!token)redirect('/display/pair');
 const result=await displayClient().rpc('get_pilot_display_debts',{device_token:token});
 if(result.error)return <main><h1>待完成資料暫時無法完整讀取</h1><p>請老師確認白板授權或作業範圍。</p><Link href="/display">白板首頁</Link></main>;
 const data=result.data as Data;
 return <main style={{height:'100%',boxSizing:'border-box',padding:20,display:'flex',flexDirection:'column',gap:16,background:'#071020',color:'#eef5ff',fontSize:20}}><header style={{flexShrink:0}}><Link href="/display" style={{color:'#a5d8ff'}}>白板首頁</Link><h1 style={{margin:'8px 0'}}>待完成作業</h1></header>{!data.learning.term?<p>尚無啟用學期。</p>:<section style={{flex:1,minHeight:0,display:'grid',gridTemplateColumns:`repeat(${data.students.length>9?5:3},minmax(0,1fr))`,gridAutoRows:'minmax(0,1fr)',gap:12}}>{data.students.map(s=>{const work=studentWork(data.assignments,data.checks,s.id,data.day),learning=studentLearning(data.learning.term!,data.day,s.id,data.learning.plans,data.learning.passport_checks,data.learning.reading_checks,data.learning.reading_enabled);const learningBlocked=learning.passports.length+learning.reading.length>0;const pending=[...work.unfinished.map(a=>({id:a.id,label:`${data.assignments.find(x=>x.id===a.id)?.book_name??''} ${a.content}`,status:homeworkStatuses.find(v=>v.id===a.status)?.name??'未交'})),...learning.passports.map(p=>({...p,status:'未完成'})),...learning.reading];return <article key={s.id} style={{minHeight:0,overflow:'auto',padding:16,border:'1px solid #475569',borderRadius:12,background:'#111e33',overflowWrap:'anywhere'}}><h2 style={{fontSize:26,margin:'0 0 10px'}}>{s.seat} {s.name}</h2><p style={{margin:'8px 0',color:work.blocksBreak||learningBlocked?'#fda4af':'#6ee7b7'}}>{work.blocksBreak||learningBlocked?'不能下課':'可以下課'} · {work.blocksShop||learningBlocked?'商店暫停':'可以兌換'}</p>{pending[0]?<><div style={{padding:12,borderRadius:10,background:'#25364d'}}><small>下一個先完成</small><p style={{fontSize:28,fontWeight:700,margin:'8px 0'}}>{pending[0].label}</p><span>{pending[0].status}</span></div>{pending.slice(1,3).map(p=><p key={p.id} style={{opacity:0.65,margin:'8px 0'}}>{p.label} · {p.status}</p>)}</>:<p style={{color:'#6ee7b7'}}>所有需完成項目都已完成。</p>}<p style={{marginBottom:0}}>尚待完成：作業 {work.unfinished.length} 項 · 護照 {learning.passports.length} 項 · 閱讀／讀報 {learning.reading.length} 項</p></article>;})}</section>}</main>;
}
