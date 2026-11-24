import {schoolDay,validRange,type Term,type DayOverride} from './calendar';
export type DutyStudent={id:string;seat:number;name:string};
export type DutyJob={id:string;name:string;group:string;slots:number;weight:number;exclusive:boolean};
export type DutyAssignment={day:string;job_id:string;slot:number;student_id:string};
export type DutyHistory={student_id:string;job_id:string;count:number;total_weight:number};
export function parseDutyJobs(input:unknown):DutyJob[]|null{
 if(!Array.isArray(input)||!input.length||input.length>30||input.some(j=>!j||typeof j!=='object'||Array.isArray(j)||!['id','name','group'].every(k=>typeof j[k]==='string')||typeof j.slots!=='number'||typeof j.weight!=='number'||typeof j.exclusive!=='boolean'))return null;
 return input.map(j=>({id:j.id,name:j.name.trim(),group:j.group.trim(),slots:j.slots,weight:j.weight,exclusive:j.exclusive}));
}
export const nineStudentDutyTemplate:DutyJob[]=[
 {id:'blackboard',name:'黑板、餐桶桌',group:'中午工作',slots:1,weight:3,exclusive:true},
 ...['掃前','拖前','掃中','拖中','掃後','拖後'].map((name,i)=>({id:`clean-${i}`,name,group:'中午工作',slots:1,weight:2,exclusive:false})),
 {id:'garbage',name:'倒垃圾',group:'中午工作',slots:2,weight:1,exclusive:false},
 {id:'carry-2',name:'餐桶（二）',group:'餐桶',slots:3,weight:1,exclusive:false},
 {id:'cart-2',name:'餐桶車（二）',group:'餐桶',slots:1,weight:1,exclusive:false},
 {id:'carry-4',name:'餐桶（四）',group:'餐桶',slots:3,weight:1,exclusive:false},
 {id:'cart-4',name:'餐桶車（四）',group:'餐桶',slots:1,weight:1,exclusive:false},
];
export function dutyJobIssues(jobs:readonly DutyJob[],students:number){
 const issues:string[]=[];
 if(!jobs.length)return ['請先新增至少一項值日工作。'];
 if(jobs.length>30)return ['最多設定 30 種工作。'];
 const ids=new Set<string>(),names=new Set<string>(),groups=new Set<string>();
 for(const job of jobs){
  if(!/^[a-z0-9_-]{1,64}$/.test(job.id)||ids.has(job.id)||!job.name.trim()||job.name.trim().length>60||!job.group.trim()||job.group.trim().length>40||!Number.isInteger(job.slots)||job.slots<1||job.slots>15||!Number.isInteger(job.weight)||job.weight<1||job.weight>10||typeof job.exclusive!=='boolean')return ['工作設定無效，請確認名稱、人數、負擔權重及不兼任選項。'];
  const name=job.group.trim().toLowerCase()+':'+job.name.trim().toLowerCase();
  if(names.has(name))return ['同一組的工作名稱不能重複，請用所需人數設定多位學生。'];
  ids.add(job.id);names.add(name);groups.add(job.group);
 }
 if(groups.size>6)return ['最多設定 6 組可平行工作的組別。'];
 if(!Number.isInteger(students)||students<1||students>15)return ['請先建立 1～15 位使用中學生。'];
 const exclusive=jobs.filter(job=>job.exclusive).reduce((n,job)=>n+job.slots,0);
 if(exclusive>students)issues.push(`不兼任工作需要 ${exclusive} 人，但目前只有 ${students} 人。`);
 const available=Math.max(0,students-exclusive);
 for(const group of groups){const demand=jobs.filter(job=>job.group===group&&!job.exclusive).reduce((n,job)=>n+job.slots,0);if(demand>available)issues.push(`「${group}」需 ${demand} 位可兼任學生；扣除不兼任工作後只有 ${available} 位。`);}
 return issues;
}
// Hungarian minimum-cost matching. Dummy columns represent students off this group.
function match(cost:number[][]){
 const n=cost.length,u=Array(n+1).fill(0),v=Array(n+1).fill(0),p=Array(n+1).fill(0),way=Array(n+1).fill(0);
 for(let i=1;i<=n;i++){
  p[0]=i;let j0=0;const min=Array(n+1).fill(Infinity),used=Array(n+1).fill(false);
  do{used[j0]=true;const i0=p[j0];let delta=Infinity,j1=0;
   for(let j=1;j<=n;j++)if(!used[j]){const cur=cost[i0-1][j-1]-u[i0]-v[j];if(cur<min[j]){min[j]=cur;way[j]=j0;}if(min[j]<delta){delta=min[j];j1=j;}}
   for(let j=0;j<=n;j++)if(used[j]){u[p[j]]+=delta;v[j]-=delta;}else min[j]-=delta;
   j0=j1;
  }while(p[j0]!==0);
  do{const j1=way[j0];p[j0]=p[j1];j0=j1;}while(j0!==0);
 }
 return p.slice(1).map(i=>i-1);
}
export function planDuty(term:Term,overrides:readonly DayOverride[],roster:readonly DutyStudent[],jobs:readonly DutyJob[],history:readonly DutyHistory[]=[]){
 jobs=jobs.map(job=>({...job,name:job.name.trim(),group:job.group.trim()}));
 const students=[...roster].sort((a,b)=>a.seat-b.seat||a.id.localeCompare(b.id));
 const issues=dutyJobIssues(jobs,students.length),days:string[]=[],assignments:DutyAssignment[]=[];
 if(!validRange(term.start_date,term.end_date))issues.push('學期起訖日期無效。');
 if(new Set(students.map(s=>s.id)).size!==students.length||new Set(students.map(s=>s.seat)).size!==students.length)issues.push('學生資料重複，無法產生輪排。');
 const counts=new Map(students.map(s=>[s.id,new Map<string,number>()])),totals=new Map(students.map(s=>[s.id,0]));
 for(const row of history){if(!counts.has(row.student_id)||!Number.isSafeInteger(row.count)||row.count<0||!Number.isSafeInteger(row.total_weight)||row.total_weight<0)continue;const map=counts.get(row.student_id)!;map.set(row.job_id,(map.get(row.job_id)??0)+row.count);totals.set(row.student_id,totals.get(row.student_id)!+row.total_weight);}
 if(!issues.length){
  for(let time=Date.parse(term.start_date);time<=Date.parse(term.end_date);time+=86400000){const day=new Date(time).toISOString().slice(0,10);if(schoolDay(day,term,overrides))days.push(day);}
  if(!days.length)issues.push('日期範圍內沒有上課日，請調整套用日期或行事曆。');
  if(days.length*jobs.reduce((n,j)=>n+j.slots,0)>20000)issues.push('排程超過 20,000 個工作名額，請縮短範圍或減少工作。');
 }
 if(!issues.length)for(const [dayIndex,day] of days.entries()){
  const reserved=new Set<string>();
  function allocate(selected:readonly DutyJob[],pool:readonly DutyStudent[]){
   const slots=selected.flatMap(job=>Array.from({length:job.slots},(_,slot)=>({job,slot:slot+1})));
   if(!slots.length)return;
   const cost=pool.map((student,index)=>Array.from({length:pool.length},(_,column)=>{
    const job=slots[column]?.job;if(!job)return 0;
    const count=counts.get(student.id)!.get(job.id)??0,total=totals.get(student.id)!;
    // Balance repetition of each role first, then cumulative weighted burden.
    const tie=(index-dayIndex-selected.findIndex(j=>j.id===job.id)*2+pool.length*1000)%pool.length;
    return (2*count+1)*job.weight*1e6+(2*total+job.weight)*job.weight*1000+tie;
   }));
   const chosen=match(cost);
   slots.forEach(({job,slot},column)=>{const student=pool[chosen[column]];assignments.push({day,job_id:job.id,slot,student_id:student.id});const map=counts.get(student.id)!;map.set(job.id,(map.get(job.id)??0)+1);totals.set(student.id,totals.get(student.id)!+job.weight);if(job.exclusive)reserved.add(student.id);});
  }
  allocate(jobs.filter(j=>j.exclusive),students);
  const pool=students.filter(student=>!reserved.has(student.id));
  for(const group of new Set(jobs.map(j=>j.group)))allocate(jobs.filter(j=>j.group===group&&!j.exclusive),pool);
 }
 return {issues,days,assignments,loads:students.map(s=>({student_id:s.id,total_weight:totals.get(s.id)!,counts:Object.fromEntries(counts.get(s.id)!)}))};
}
