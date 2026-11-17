import {termWeek,type Term} from "./calendar";
import {passportWeeks} from "./passports";
import {readingKinds,readingMonths,readingMonthOverdue,readingStatuses} from "./reading";
export type PassportPlan={id:string;name:string;first_week:number;last_week:number;archived:boolean};
export type PassportCheck={passport_id:string;student_id:string;week:number;completed:boolean};
export type ReadingCheck={student_id:string;kind:string;month:string;status:string};
export function studentLearning(term:Term,day:string,studentId:string,plans:readonly PassportPlan[],passportChecks:readonly PassportCheck[],readingChecks:readonly ReadingCheck[],includeReading:boolean){
 const week=day<term.start_date?0:termWeek(day>term.end_date?term.end_date:day,term)??0;
 const done=new Set(passportChecks.filter(row=>row.student_id===studentId&&row.completed).map(row=>`${row.passport_id}:${row.week}`));
 const passports=plans.filter(plan=>!plan.archived).flatMap(plan=>passportWeeks(plan.first_week,plan.last_week).filter(value=>value<=week&&!done.has(`${plan.id}:${value}`)).map(value=>({id:`${plan.id}:${value}`,label:`${plan.name} W${value}`,week:value}))).sort((a,b)=>a.week-b.week||a.id.localeCompare(b.id));
 const statusMap=new Map(readingChecks.filter(row=>row.student_id===studentId).map(row=>[`${row.kind}:${row.month}`,row.status]));
 const reading=includeReading?readingMonths(term.start_date,term.end_date).filter(month=>readingMonthOverdue(month,day)).flatMap(month=>readingKinds.filter(kind=>statusMap.get(`${kind.id}:${month}`)!=="completed").map(kind=>({id:`${kind.id}:${month}`,label:`${kind.name} ${month.slice(0,7)}`,status:readingStatuses.find(status=>status.id===statusMap.get(`${kind.id}:${month}`))?.name??"未開始"}))):[];
 return {passports,reading};
}
