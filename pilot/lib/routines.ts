export const routineTasks=[
 {id:"morning_cleaning",name:"上午打掃"},
 {id:"contact_book_copied",name:"抄聯絡簿"},
 {id:"lunch_brushing",name:"午餐刷牙"},
 {id:"noon_cleaning",name:"中午打掃"},
] as const;
export function validRoutine(value:string){return routineTasks.some(task=>task.id===value);}
export type RoutineStudent={id:string;seat:number;name:string};
export type RoutineCheck={student_id:string;task_key:string;completed:boolean};
export function routineProgress(students:readonly RoutineStudent[],checks:readonly RoutineCheck[],absences:readonly {student_id:string;absent:boolean}[],task:string){
 const absent=new Set(absences.filter(item=>item.absent).map(item=>item.student_id));
 const complete=new Set(checks.filter(item=>item.task_key===task&&item.completed).map(item=>item.student_id));
 const roster=students.map(student=>({...student,absent:absent.has(student.id),completed:complete.has(student.id)}));
 const present=roster.filter(student=>!student.absent);
 return {roster,total:present.length,completed:present.filter(student=>student.completed).length,missing:present.filter(student=>!student.completed)};
}
