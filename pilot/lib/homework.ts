export const homeworkStatuses=[
 {id:"missing",name:"未交"},
 {id:"pending",name:"待確認"},
 {id:"correction",name:"未訂正完成"},
 {id:"completed",name:"已完成"},
] as const;
export type HomeworkStatus=typeof homeworkStatuses[number]["id"];
export function validHomeworkStatus(value:string):value is HomeworkStatus {
 return homeworkStatuses.some(status=>status.id===value);
}
export function isHandedIn(value:HomeworkStatus) {return value!=="missing";}
