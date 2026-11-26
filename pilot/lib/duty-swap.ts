import type {DutyAssignment,DutyJob,DutyStudent,DutyHistory} from './duty';

/** Swap people, never work slots. Return no partial edits if either day would conflict. */
export function swapDutyDraft(rows:readonly DutyAssignment[],jobs:readonly DutyJob[],first:number,second:number){
 if(!Number.isInteger(first)||!Number.isInteger(second)||first===second||!rows[first]||!rows[second])return {error:'請選擇兩個不同的工作名額。'};
 if(rows[first].student_id===rows[second].student_id)return {error:'這兩項工作已由同一位學生負責。'};
 const result=rows.map(row=>({...row}));
 [result[first].student_id,result[second].student_id]=[result[second].student_id,result[first].student_id];
 const affected=new Set([rows[first].day,rows[second].day]),byJob=new Map(jobs.map(job=>[job.id,job]));
 const occupied=new Map<string,{groups:Set<string>;exclusive:boolean;count:number}>();
 for(const row of result){
  if(!affected.has(row.day))continue;
  const job=byJob.get(row.job_id);if(!job)return {error:'工作設定已更新，請重新產生預覽。'};
  const key=`${row.day}:${row.student_id}`,state=occupied.get(key)??{groups:new Set<string>(),exclusive:false,count:0};
  if(state.groups.has(job.group)||(state.count>0&&(state.exclusive||job.exclusive)))return {error:'交換後會有同組工作重複，或不兼任工作衝突，請選擇其他名額。'};
  state.groups.add(job.group);state.exclusive ||=job.exclusive;state.count++;occupied.set(key,state);
 }
 return {assignments:result};
}

export function dutyDraftLoads(rows:readonly DutyAssignment[],jobs:readonly DutyJob[],students:readonly DutyStudent[],history:readonly DutyHistory[]){
 const loads=new Map(students.map(s=>[s.id,{student_id:s.id,total_weight:0,counts:{} as Record<string,number>} ])),weights=new Map(jobs.map(job=>[job.id,job.weight]));
 for(const row of history){const load=loads.get(row.student_id);if(!load)continue;load.total_weight+=row.total_weight;load.counts[row.job_id]=(load.counts[row.job_id]??0)+row.count;}
 for(const row of rows){const load=loads.get(row.student_id);if(!load)continue;load.total_weight+=weights.get(row.job_id)??0;load.counts[row.job_id]=(load.counts[row.job_id]??0)+1;}
 return [...loads.values()];
}
