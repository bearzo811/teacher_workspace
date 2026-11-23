import {notFound} from 'next/navigation';
import {PointsView,type Points} from '../students/view';
import {DebtsView,type Data} from '../debts/view';
import {CalendarView,type Calendar} from '../calendar/view';
import {LearningView,type Snapshot} from '../learning/view';
import {OrderEditor} from '../../workspace/debts/order-editor';
export const dynamic='force-dynamic';
// Pure visual fixtures only. This route never reads or writes any database.
export default async function Preview({searchParams}:{searchParams:Promise<{count?:string;view?:string;mode?:string}>}){
 if(process.env.NODE_ENV!=='development')notFound();
 const params=await searchParams,count=['1','9','15'].includes(params.count??'')?Number(params.count):9;
 const students=Array.from({length:count},(_,i)=>({id:`00000000-0000-4000-8000-${String(i+1).padStart(12,'0')}`,seat:i+1,name:`虛構學生${String(i+1).padStart(2,'0')}`}));
 if(params.view==='order')return <main style={{padding:24,background:'#fff',color:'#111827',height:'100%',overflow:'auto',boxSizing:'border-box'}}><h1>虛構學生個人排序預覽</h1><OrderEditor classroom="fixture" student="fixture" term="fixture" version={0} showMore={true} preview items={[{id:'math',label:'數學習作 p.35–38 · 待確認'},{id:'chinese',label:'國語第十課生字訂正 · 未訂正完成'},{id:'passport',label:'國語護照 W13 · 未完成'},{id:'reading',label:'閱讀心得 2026-10 · 未開始'}]}/></main>;
 if(params.view==='calendar'){
  const data:Calendar={today:'2026-11-23',month:'2026-11-01',term:{id:'fixture-term',name:'虛構學期',start_date:'2026-09-01',end_date:'2027-01-22',active:true},days:[],events:[{id:'today',title:'虛構校外教學活動',day:'2026-11-23',note:'僅供排版驗收'}],countdowns:Array.from({length:50},(_,i)=>({id:`event-${i}`,title:`虛構活動 ${i+1}`,day:'2027-01-08',note:'跨年活動倒數與獨立捲動驗收。'}))};
  return <CalendarView data={data}/>;
 }
 if(params.view==='learning'){
  const data:Snapshot={day:'2026-11-23',term:{id:'fixture-term',name:'虛構學期',start_date:'2026-09-01',end_date:'2027-01-22',active:true},passport_enabled:true,reading_enabled:true,students,plans:[{id:'chinese',name:'國語護照',first_week:3,last_week:16},{id:'english',name:'英語護照',first_week:3,last_week:16}],passport_checks:students.flatMap((s,i)=>[3,4,5,6,7,8,9,10,11,12,13].filter(w=>(w+i)%3!==0).flatMap(week=>['chinese','english'].map(passport_id=>({student_id:s.id,passport_id,week,completed:true})))),months:['2026-09-01','2026-10-01','2026-11-01','2026-12-01','2027-01-01'],reading_checks:students.flatMap((s,i)=>['2026-09-01','2026-10-01'].flatMap(month=>['newspaper','reflection'].map(kind=>({student_id:s.id,kind,month,status:i%3===0?'missing_parent':'completed'}))))};
  return <LearningView data={data} requestedMode={params.mode}/>;
 }
 if(params.view!=='debts'){
  const data:Points={enabled:true,rules_confirmed:true,level_base_xp:100,shop_open:false,students:students.map((s,i)=>({...s,coin_net:i*15-2,xp_total:i*123}))};
  return <PointsView data={data}/>;
 }
 const assignments=Array.from({length:3},(_,i)=>({id:`work-${i}`,content:['第七單元 p.35–38','國語第十課生字訂正','英文練習本 p.12–15'][i],contact_day:`2026-11-${String(20-i).padStart(2,'0')}`,due_day:`2026-11-${String(23-i).padStart(2,'0')}`,workbook_id:`book-${i}`,book_name:['數學習作','國語作業','英語練習'][i],blocks_break:i!==2,blocks_shop:true}));
 const checks=students.flatMap((s,i)=>assignments.map((a,j)=>({student_id:s.id,assignment_id:a.id,status:i%3===0?'completed':j===0?'pending':j===1?'correction':'missing'})));
 const data:Data={day:'2026-11-23',students,assignments,checks,learning:{term:{id:'fixture-term',name:'虛構學期',start_date:'2026-09-01',end_date:'2027-01-22',active:true},plans:[{id:'fixture-passport',name:'國語護照',first_week:11,last_week:14,archived:false}],passport_checks:students.filter((_,i)=>i%3===0).flatMap(s=>[11,12,13].map(week=>({passport_id:'fixture-passport',student_id:s.id,week,completed:true}))),reading_checks:students.filter((_,i)=>i%3===0).flatMap(s=>['2026-09-01','2026-10-01'].flatMap(month=>['newspaper','reflection'].map(kind=>({student_id:s.id,kind,month,status:'completed'})))),reading_enabled:true}};
 return <DebtsView data={data}/>;
}
