"use client";
import {useMemo,useState} from 'react';
import {planDuty,nineStudentDutyTemplate,parseDutyJobs,type DutyJob,type DutyStudent,type DutyHistory} from '../../../lib/duty';
import {type Term,type DayOverride} from '../../../lib/calendar';
import {publishDuty} from './actions';
import {swapDutyDraft,dutyDraftLoads} from '../../../lib/duty-swap';
import {Submit} from '../submit';
export type DutyContext={term:Term;revision:number;jobs:DutyJob[];starts_on:string;students:DutyStudent[];overrides:DayOverride[];history:DutyHistory[]};
export function DutyPlanner({classroom,context,request,preview=false}:{classroom:string;context:DutyContext;request:string;preview?:boolean}){
 const [jobs,setJobs]=useState<DutyJob[]>(context.jobs),[month,setMonth]=useState(context.starts_on.slice(0,7));
 const normalized=useMemo(()=>parseDutyJobs(jobs)??[],[jobs]);
 const base=useMemo(()=>planDuty({...context.term,start_date:context.starts_on},context.overrides,context.students,normalized,context.history),[context,normalized]);
 const [draft,setDraft]=useState<{base:typeof base;rows:typeof base.assignments;count:number}|null>(null);
 const [selection,setSelection]=useState<{base:typeof base;index:number}|null>(null),[swapError,setSwapError]=useState('');
 const assignments=draft?.base===base?draft.rows:base.assignments;
 const selected=selection?.base===base?selection.index:null;
 const plan={...base,assignments,loads:useMemo(()=>dutyDraftLoads(assignments,normalized,context.students,context.history),[assignments,normalized,context])};
 function choose(index:number){
  setSwapError('');if(selected===null){setSelection({base,index});return;}if(selected===index){setSelection(null);return;}
  const result=swapDutyDraft(assignments,normalized,selected,index);
  if(result.error){setSwapError(result.error);return;}
  setDraft({base,rows:result.assignments!,count:(draft?.base===base?draft.count:0)+1});setSelection(null);
 }
 const byStudentDay=useMemo(()=>{const map=new Map<string,typeof assignments>();for(const row of assignments){const key=`${row.day}:${row.student_id}`;const list=map.get(key)??[];list.push(row);map.set(key,list);}return map;},[assignments]);
 const months=Array.from(new Set(plan.days.map(day=>day.slice(0,7))));
 const update=(index:number,patch:Partial<DutyJob>)=>setJobs(current=>current.map((job,i)=>i===index?{...job,...patch}:job));
 const input={padding:8,maxWidth:'100%',boxSizing:'border-box' as const};
 return <section style={{marginTop:24}}><h2>設定工作並預覽輪排</h2><p>同一組的工作每人每天只分配一項，不同組可以兼任。「不兼任」會讓該職務的學生不接其他工作。先平衡各項工作輪到的次數，再考慮累積負擔；請假不會自動改排給別人，代班功能另行處理。</p>
 <button type="button" onClick={()=>setJobs(nineStudentDutyTemplate.map(j=>({...j})))}>套用九人餐桶／打掃範例</button> <button type="button" disabled={jobs.length>=30} onClick={()=>setJobs(current=>[...current,{id:crypto.randomUUID(),name:'新工作',group:'中午工作',slots:1,weight:1,exclusive:false}])}>新增工作</button>
 <div style={{overflowX:'auto',marginTop:12}}><table style={{borderCollapse:'collapse',minWidth:760,width:'100%'}}><thead><tr>{['工作名稱','組別（同組不兼任）','每天人數','負擔權重（1～10）','不兼任其他工作',''].map(label=><th key={label} style={{textAlign:'left',padding:8}}>{label}</th>)}</tr></thead><tbody>{jobs.map((job,index)=><tr key={job.id}>
 <td><input aria-label={`工作 ${index+1} 名稱`} value={job.name} maxLength={60} onChange={e=>update(index,{name:e.target.value})} style={input}/></td><td><input aria-label={`工作 ${index+1} 組別`} value={job.group} maxLength={40} onChange={e=>update(index,{group:e.target.value})} style={input}/></td><td><input aria-label={`工作 ${index+1} 人數`} type="number" min={1} max={15} value={Number.isNaN(job.slots)?'':job.slots} onChange={e=>update(index,{slots:Number(e.target.value)})} style={{...input,width:80}}/></td><td><input aria-label={`工作 ${index+1} 負擔權重`} type="number" min={1} max={10} value={Number.isNaN(job.weight)?'':job.weight} onChange={e=>update(index,{weight:Number(e.target.value)})} style={{...input,width:80}}/></td><td><input aria-label={`工作 ${index+1} 不兼任`} type="checkbox" checked={job.exclusive} onChange={e=>update(index,{exclusive:e.target.checked})}/></td><td><button type="button" aria-label={`移除${job.name}`} onClick={()=>setJobs(current=>current.filter((_,i)=>i!==index))}>移除</button></td>
 </tr>)}</tbody></table></div>
 {plan.issues.length?<div role="alert"><ul>{plan.issues.map(issue=><li key={issue}>{issue}</li>)}</ul><p>目前不會產生或發布排程，請先調整人力需求。</p></div>:<><h3>輪排預覽：{context.starts_on}～{context.term.end_date}</h3><p>{context.students.length} 位學生 · {plan.days.length} 個上課日 · {plan.assignments.length} 個工作名額。此處尚未儲存，發布後才成為正式值日表。</p><label>預覽月份 <select value={months.includes(month)?month:months[0]} onChange={e=>setMonth(e.target.value)}>{months.map(value=><option key={value}>{value}</option>)}</select></label>
 <div style={{maxHeight:480,overflow:'auto',marginTop:12}}><table style={{width:'100%',borderCollapse:'collapse'}}><thead><tr><th>日期</th><th>每位學生的工作</th></tr></thead><tbody>{plan.days.filter(day=>day.startsWith(months.includes(month)?month:months[0])).map(day=><tr key={day}><th style={{verticalAlign:'top',padding:8,whiteSpace:'nowrap'}}>{day}</th><td style={{padding:8,borderBottom:'1px solid #cbd5e1'}}>{context.students.map(student=>{const rows=byStudentDay.get(`${day}:${student.id}`)??[];return <div key={student.id}><strong>{student.name}</strong>：{rows.length?rows.map(a=>normalized.find(j=>j.id===a.job_id)!.name).join('、'):'本日未分配工作'}</div>;})}</td></tr>)}</tbody></table></div>
 <details><summary>手動交換預覽中的工作</summary><p>先選一個名額，再選另一個即可交換；可切換月份跨日交換。同組重複與不兼任衝突會被阻擋。只修改這份預覽，發布後才生效；更改工作設定會清除手動調整。</p><p role="status">{draft?.base===base?`已調整 ${draft.count} 次。`:'尚無手動調整。'}{selected!==null&&` 已選 ${assignments[selected].day} · ${normalized.find(j=>j.id===assignments[selected].job_id)?.name} · ${context.students.find(s=>s.id===assignments[selected].student_id)?.name}`}</p>{swapError&&<p role="alert">{swapError}</p>}<button type="button" onClick={()=>{setDraft(null);setSelection(null);setSwapError('');}}>重設所有手動交換</button><div style={{maxHeight:360,overflow:'auto',display:'flex',gap:8,flexWrap:'wrap',marginTop:12}}>{assignments.map((row,index)=>row.day.startsWith(months.includes(month)?month:months[0])?<button key={`${row.day}:${row.job_id}:${row.slot}`} type="button" aria-pressed={selected===index} onClick={()=>choose(index)} style={{padding:10,border:selected===index?'2px solid #2563eb':'1px solid #cbd5e1',borderRadius:8}}>{row.day} · {normalized.find(j=>j.id===row.job_id)?.name} {row.slot} · {context.students.find(s=>s.id===row.student_id)?.name}</button>:null)}</div></details>
 <details><summary>查看累積工作負擔與各職務次數</summary><p>包含套用日前的既有排程與本次預覽、手動交換；負擔權重是輪排比較值，不是金幣或經驗值。</p><ul>{plan.loads.map(load=><li key={load.student_id}>{context.students.find(s=>s.id===load.student_id)?.name} · 累積負擔 {load.total_weight} · {normalized.map(job=>`${job.name} ${load.counts[job.id]??0} 次`).join('、')}</li>)}</ul></details></>}
 <form action={publishDuty} onSubmit={preview?event=>event.preventDefault():undefined}><input type="hidden" name="class" value={classroom}/><input type="hidden" name="term" value={context.term.id}/><input type="hidden" name="from" value={context.starts_on}/><input type="hidden" name="revision" value={context.revision}/><input type="hidden" name="request" value={request}/><input type="hidden" name="jobs" value={JSON.stringify(normalized)}/><input type="hidden" name="schedule" value={JSON.stringify(plan.assignments)}/><input type="hidden" name="roster" value={JSON.stringify(context.students)}/>
 <fieldset disabled={!!plan.issues.length||preview} style={{marginTop:16}}><legend>確認發布</legend><label><input type="checkbox" name="confirm" value="yes" required/>我已檢查工作內容、人數與輪排預覽，確認從 {context.starts_on} 套用。原先排程及歷史會保留，不發扣金幣。</label><p><Submit>發布這份值日表</Submit></p></fieldset></form>
 </section>;
}
