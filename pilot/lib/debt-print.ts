import {validDate} from "./calendar";
export type PrintParams={student?:string;term?:string;from?:string;day?:string};
export function validPrintScope(params:PrintParams,today:string){
 const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
 return uuid.test(params.student??"")&&uuid.test(params.term??"")&&validDate(params.from??"")&&validDate(params.day??"")&&params.from!<=params.day!&&params.day!<=today;
}
export function checklistRows(work:readonly {id:string;label:string;status:string}[],learning:{passports:readonly {id:string;label:string}[];reading:readonly {id:string;label:string;status:string}[]}){
 return [...work.map(item=>({...item,id:`homework:${item.id}`})),...learning.passports.map(item=>({id:`passport:${item.id}`,label:item.label,status:"未開始"})),...learning.reading.map(item=>({...item,id:`reading:${item.id}`}))];
}
