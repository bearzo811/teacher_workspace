import {validHomeworkStatus,type HomeworkStatus} from "./homework";
export type DebtAssignment={id:string;content:string;contact_day:string;due_day:string;workbook_id:string;blocks_break:boolean;blocks_shop:boolean;archived?:boolean};
export type DebtCheck={assignment_id:string;student_id:string;status:string};
export function studentWork(assignmentList:readonly DebtAssignment[],checks:readonly DebtCheck[],studentId:string,cutoff:string) {
 const map=new Map(checks.filter(check=>check.student_id===studentId).map(check=>[check.assignment_id,check.status]));
 const all=assignmentList.filter(item=>!item.archived&&item.due_day<=cutoff).map(item=>{
  const value=map.get(item.id)??"missing";
  const status:HomeworkStatus=validHomeworkStatus(value)?value:"missing";
  return {...item,status};
 }).sort((a,b)=>b.contact_day.localeCompare(a.contact_day)||b.due_day.localeCompare(a.due_day)||a.id.localeCompare(b.id));
 const unfinished=all.filter(item=>item.status!=="completed");
 return {all,unfinished,missing:unfinished.filter(item=>item.status==="missing").length,
  pending:unfinished.filter(item=>item.status==="pending").length,
  correction:unfinished.filter(item=>item.status==="correction").length,
  blocksBreak:unfinished.some(item=>item.blocks_break),blocksShop:unfinished.some(item=>item.blocks_shop)};
}
