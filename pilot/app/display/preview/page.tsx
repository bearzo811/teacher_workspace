import {notFound} from 'next/navigation';
import {type ReactNode,type CSSProperties} from 'react';
import {PointsView,type Points} from '../students/view';
import {DebtsView,type Data} from '../debts/view';
import {CalendarView,type Calendar} from '../calendar/view';
import {LearningView,type Snapshot} from '../learning/view';
import {OrderEditor} from '../../workspace/debts/order-editor';
import {DutyPlanner} from '../../workspace/duty/planner';
import {nineStudentDutyTemplate,planDuty} from '../../../lib/duty';
import {LunchView} from '../lunch/view';
import {SubstitutePanel} from '../contact-book/substitutes';
import {LunchMediaSurface} from '../lunch/media-player';
import {FileCheck} from '../../workspace/exports/file-check';
import {exportFixture} from './export-fixture';
export const dynamic='force-dynamic';
// Pure visual fixtures only. This route never reads or writes any database.
export default async function Preview({searchParams}:{searchParams:Promise<{count?:string;view?:string;mode?:string;font?:string}>}){
 if(process.env.NODE_ENV!=='development')notFound();
 const params=await searchParams,count=['1','9','15'].includes(params.count??'')?Number(params.count):9;
 const font=['16','22','32'].includes(params.font??'')?Number(params.font):22;
 const wrap=(node:ReactNode)=><div style={{height:'100%','--pilot-display-scale':font/22} as CSSProperties}>{node}</div>;
 const students=Array.from({length:count},(_,i)=>({id:`00000000-0000-4000-8000-${String(i+1).padStart(12,'0')}`,seat:i+1,name:`虛構學生${String(i+1).padStart(2,'0')}`}));
 if(params.view==='export'){const fixture=exportFixture(count);return <main style={{height:'100%',overflow:'auto',padding:24,boxSizing:'border-box',background:'#fff',color:'#111827',lineHeight:1.8}}><h1>匯出檔檢查（虛構預覽）</h1><p>此頁不讀寫資料庫。</p><FileCheck classId={fixture.classId} receipts={[fixture.envelope]}/></main>;}
 if(params.view==='media')return wrap(<LunchMediaSurface preview initial={{video_id:params.mode==='short'?'jNQXAC9IVRw':'M7lc1UVf-VE',title:'午餐播放器驗收',version:1}} fallback={<div style={{height:'100%',padding:24,background:'#071020',color:'#fff',boxSizing:'border-box'}}><h1>午餐工作與任務（虛構預覽）</h1><p>影片結束後恢復此區。本預覽不讀寫資料庫。</p></div>}/>);
 if(params.view==='covers')return wrap(<main style={{height:'100%',padding:20,boxSizing:'border-box',background:'#071020',color:'#eef5ff',display:'grid',gridTemplateColumns:'1fr 1fr',gap:16}}><section style={{display:'flex',flexDirection:'column',gap:12,minHeight:0,overflowY:'auto'}}><article style={{flex:1,padding:24,border:'6px solid #80501f',background:'#123f30',borderRadius:12}}><h1>聯絡簿（虛構預覽）</h1><p>1. 數學習作 p.35–38</p></article><SubstitutePanel preview student={students[0].id} absent={false} data={{rule_version:1,ready:true,opportunities:[{student_id:'absent',name:'虛構請假同學',jobs:['餐桶（二）','掃前'],cover_id:null,status:null,helper_name:null,coins:3,basis_changed:false}]}}/></section><section><h2>今日進度</h2><p>代班區固定在聯絡簿下方；接班後由老師確認完成。</p></section></main>);
 if(params.view==='lunch'){
  const jobs=count>=9?nineStudentDutyTemplate:[nineStudentDutyTemplate[0]],duties=planDuty({id:'fixture',name:'虛構',start_date:'2026-11-23',end_date:'2026-11-23',active:true},[],students,jobs);
  return wrap(<LunchView preview data={{day:'2026-11-23',school_day:true,duty_enabled:true,routines_enabled:true,students,jobs:duties.assignments.map(a=>({id:`${a.job_id}:${a.slot}`,student_id:a.student_id,job_name:jobs.find(j=>j.id===a.job_id)!.name,group:jobs.find(j=>j.id===a.job_id)!.group})),checks:students.flatMap((s,i)=>[{student_id:s.id,task_key:'lunch_brushing',completed:i%3===0},{student_id:s.id,task_key:'noon_cleaning',completed:i%4===0}]),attendance:[]}}/>);
 }
 if(params.view==='duty')return <main style={{padding:24,background:'#fff',color:'#111827',height:'100%',overflow:'auto',boxSizing:'border-box'}}><h1>虛構班值日輪排預覽</h1><DutyPlanner classroom="fixture" request="fixture" preview context={{term:{id:'fixture',name:'虛構學期',start_date:'2026-09-01',end_date:'2027-01-22',active:true},revision:0,jobs:nineStudentDutyTemplate,starts_on:'2026-09-01',students,overrides:[{day:'2026-09-04',is_school_day:false,note:'虛構放假'},{day:'2026-09-05',is_school_day:true,note:'虛構補課'}],history:[]}}/></main>;
 if(params.view==='order')return <main style={{padding:24,background:'#fff',color:'#111827',height:'100%',overflow:'auto',boxSizing:'border-box'}}><h1>虛構學生個人排序預覽</h1><OrderEditor classroom="fixture" student="fixture" term="fixture" version={0} showMore={true} preview items={[{id:'math',label:'數學習作 p.35–38 · 待確認'},{id:'chinese',label:'國語第十課生字訂正 · 未訂正完成'},{id:'passport',label:'國語護照 W13 · 未完成'},{id:'reading',label:'閱讀心得 2026-10 · 未開始'}]}/></main>;
 if(params.view==='calendar'){
  const data:Calendar={today:'2026-11-23',month:'2026-11-01',term:{id:'fixture-term',name:'虛構學期',start_date:'2026-09-01',end_date:'2027-01-22',active:true},days:[],events:[{id:'today',title:'虛構校外教學活動',day:'2026-11-23',note:'僅供排版驗收'}],countdowns:Array.from({length:50},(_,i)=>({id:`event-${i}`,title:`虛構活動 ${i+1}`,day:'2027-01-08',note:'跨年活動倒數與獨立捲動驗收。'}))};
  return wrap(<CalendarView data={data}/>);
 }
 if(params.view==='learning'){
  const data:Snapshot={day:'2026-11-23',term:{id:'fixture-term',name:'虛構學期',start_date:'2026-09-01',end_date:'2027-01-22',active:true},passport_enabled:true,reading_enabled:true,students,plans:[{id:'chinese',name:'國語護照',first_week:3,last_week:16},{id:'english',name:'英語護照',first_week:3,last_week:16}],passport_checks:students.flatMap((s,i)=>[3,4,5,6,7,8,9,10,11,12,13].filter(w=>(w+i)%3!==0).flatMap(week=>['chinese','english'].map(passport_id=>({student_id:s.id,passport_id,week,completed:true})))),months:['2026-09-01','2026-10-01','2026-11-01','2026-12-01','2027-01-01'],reading_checks:students.flatMap((s,i)=>['2026-09-01','2026-10-01'].flatMap(month=>['newspaper','reflection'].map(kind=>({student_id:s.id,kind,month,status:i%3===0?'missing_parent':'completed'}))))};
  return wrap(<LearningView data={data} requestedMode={params.mode}/>);
 }
 if(params.view!=='debts'){
  const data:Points={enabled:true,rules_confirmed:true,level_base_xp:100,shop_open:false,students:students.map((s,i)=>({...s,coin_net:i*15-2,xp_total:i*123}))};
  return wrap(<PointsView data={data}/>);
 }
 const assignments=Array.from({length:3},(_,i)=>({id:`work-${i}`,content:['第七單元 p.35–38','國語第十課生字訂正','英文練習本 p.12–15'][i],contact_day:`2026-11-${String(20-i).padStart(2,'0')}`,due_day:`2026-11-${String(23-i).padStart(2,'0')}`,workbook_id:`book-${i}`,book_name:['數學習作','國語作業','英語練習'][i],blocks_break:i!==2,blocks_shop:true}));
 const checks=students.flatMap((s,i)=>assignments.map((a,j)=>({student_id:s.id,assignment_id:a.id,status:i%3===0?'completed':j===0?'pending':j===1?'correction':'missing'})));
 const data:Data={day:'2026-11-23',students,assignments,checks,learning:{term:{id:'fixture-term',name:'虛構學期',start_date:'2026-09-01',end_date:'2027-01-22',active:true},plans:[{id:'fixture-passport',name:'國語護照',first_week:11,last_week:14,archived:false}],passport_checks:students.filter((_,i)=>i%3===0).flatMap(s=>[11,12,13].map(week=>({passport_id:'fixture-passport',student_id:s.id,week,completed:true}))),reading_checks:students.filter((_,i)=>i%3===0).flatMap(s=>['2026-09-01','2026-10-01'].flatMap(month=>['newspaper','reflection'].map(kind=>({student_id:s.id,kind,month,status:'completed'})))),reading_enabled:true}};
 return wrap(<DebtsView data={data}/>);
}
