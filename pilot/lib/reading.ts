import {validDate} from "./calendar";
export const readingKinds=[{id:"newspaper",name:"讀報"},{id:"reflection",name:"閱讀心得"}] as const;
export const readingStatuses=[{id:"not_started",name:"未開始"},{id:"missing_parent",name:"缺家長"},{id:"completed",name:"已完成"}] as const;
export function validReadingStatus(value:string){return readingStatuses.some(status=>status.id===value);}
export function readingMonths(start:string,end:string){
 if(!validDate(start)||!validDate(end)||start>end||Date.parse(end)-Date.parse(start)>366*86400000)return [];
 const months:string[]=[];const cursor=new Date(`${start.slice(0,7)}-01T00:00:00Z`);
 while(cursor.toISOString().slice(0,10)<=end){const month=cursor.getUTCMonth()+1;if(month!==7&&month!==8)months.push(cursor.toISOString().slice(0,10));cursor.setUTCMonth(cursor.getUTCMonth()+1);}return months;
}
export function readingMonthOverdue(month:string,today:string){
 if(!validDate(month)||!month.endsWith('-01')||!validDate(today))return false;
 const next=new Date(month+'T00:00:00Z');next.setUTCMonth(next.getUTCMonth()+1);return next.toISOString().slice(0,10)<=today;
}
