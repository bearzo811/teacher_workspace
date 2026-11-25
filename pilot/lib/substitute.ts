/** Read-model helpers only. Signup, approval and coins must be validated atomically by SQL. */
import type {DutyHistory} from './duty';
export type PublishedDuty = {
 id:string; student_id:string; job_id:string; job_name:string; group_key:string; weight:number;
};
export type DutyCover = {
 id:string; absent_student_id:string; helper_student_id:string;
 status:'claimed'|'approved'|'cancelled'; assignment_ids:readonly string[];
};
export type EffectiveDuty = PublishedDuty & {original_student_id:string;cover_id:string|null};

/** Active claims change today's displayed owner; only approved work changes fairness history. */
export function coveredDuties(assignments:readonly PublishedDuty[],covers:readonly DutyCover[],purpose:'display'|'history'):EffectiveDuty[]{
 const owners=new Map<string,DutyCover>();
 const originals=new Map(assignments.map(row=>[row.id,row]));
 if(originals.size!==assignments.length)throw new Error('Duplicate published duty');
 for(const cover of covers){
  if(cover.status==='cancelled'||(purpose==='history'&&cover.status!=='approved'))continue;
  if(cover.absent_student_id===cover.helper_student_id||!cover.assignment_ids.length||new Set(cover.assignment_ids).size!==cover.assignment_ids.length)throw new Error('Invalid duty cover');
  for(const id of cover.assignment_ids){
   const original=originals.get(id);
   if(!original||original.student_id!==cover.absent_student_id||owners.has(id))throw new Error('Duty cover ownership conflict');
   owners.set(id,cover);
  }
 }
 return assignments.map(row=>{
  const cover=owners.get(row.id);
  return {...row,original_student_id:row.student_id,student_id:cover?.helper_student_id??row.student_id,cover_id:cover?.id??null};
 });
}

export function substituteOpportunities(assignments:readonly PublishedDuty[],absentStudentIds:ReadonlySet<string>,covers:readonly DutyCover[]){
 // Reject inconsistent claims rather than showing two helpers for the same work.
 coveredDuties(assignments,covers,'display');
 const active=new Map<string,DutyCover>();
 for(const cover of covers.filter(row=>row.status!=='cancelled')){
  if(active.has(cover.absent_student_id))throw new Error('Duplicate active duty cover');
  active.set(cover.absent_student_id,cover);
 }
 const grouped=new Map<string,PublishedDuty[]>();
 for(const row of assignments){
  if(!absentStudentIds.has(row.student_id))continue;
  const jobs=grouped.get(row.student_id)??[];jobs.push({...row});grouped.set(row.student_id,jobs);
 }
 return [...grouped].map(([student_id,jobs])=>({student_id,jobs,cover:active.get(student_id)??null}));
}

/** Use only the applicable published revision for each date before calling this helper. */
export function coveredDutyHistory(assignments:readonly PublishedDuty[],covers:readonly DutyCover[]):DutyHistory[]{
 const history=new Map<string,Map<string,DutyHistory>>();
 for(const row of coveredDuties(assignments,covers,'history')){
  if(!Number.isSafeInteger(row.weight)||row.weight<1||row.weight>10)throw new Error('Invalid duty weight');
  const student=history.get(row.student_id)??new Map<string,DutyHistory>();
  const load=student.get(row.job_id)??{student_id:row.student_id,job_id:row.job_id,count:0,total_weight:0};
  load.count++;load.total_weight+=row.weight;student.set(row.job_id,load);history.set(row.student_id,student);
 }
 return [...history.values()].flatMap(jobs=>[...jobs.values()]).sort((a,b)=>a.student_id.localeCompare(b.student_id)||a.job_id.localeCompare(b.job_id));
}
