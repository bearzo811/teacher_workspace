import {isHandedIn,validHomeworkStatus,type HomeworkStatus} from "./homework";
export type ProgressAssignment={id:string;content:string;contact_day:string;due_day:string;archived:boolean};
export type ProgressCheck={assignment_id:string;student_id:string;status:string};
export function workbookProgress(students:readonly {id:string;seat:number;name:string}[],assignments:readonly ProgressAssignment[],checks:readonly ProgressCheck[],cutoff:string){
 const items=assignments.filter(item=>!item.archived&&item.due_day<=cutoff).sort((a,b)=>a.contact_day.localeCompare(b.contact_day)||a.id.localeCompare(b.id));
 const states=new Map(checks.map(check=>[`${check.assignment_id}:${check.student_id}`,check.status]));
 const rows=students.map(student=>{const statuses=items.map(item=>{const state=states.get(`${item.id}:${student.id}`)??"missing";return validHomeworkStatus(state)?state:"missing" as HomeworkStatus;});const completed=statuses.filter(status=>status==="completed").length;return {...student,statuses,completed,handedIn:statuses.filter(isHandedIn).length,total:items.length,percent:items.length?Math.round(completed/items.length*100):null};});
 return {items,rows};
}
