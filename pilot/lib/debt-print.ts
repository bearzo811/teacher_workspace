import {validDate} from "./calendar";
export type PrintParams={student?:string;term?:string;from?:string;day?:string};
export function validPrintScope(params:PrintParams,today:string){
 const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
 return uuid.test(params.student??"")&&uuid.test(params.term??"")&&validDate(params.from??"")&&validDate(params.day??"")&&params.from!<=params.day!&&params.day!<=today;
}
