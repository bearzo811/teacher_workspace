export const returnTasks=[{id:"morning_cleaning",name:"上午打掃"},{id:"summer_homework_submitted",name:"交暑假作業"}] as const;
export function validReturnTask(value:string){return returnTasks.some(task=>task.id===value);}
