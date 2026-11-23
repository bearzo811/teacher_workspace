export type DebtPreference={student_id:string;term_id:string;ordered_keys:string[];show_more:boolean;version:number};
// Missing/completed/archived keys never create phantom debt. New items keep default order.
export function orderDebt<T extends {id:string}>(items:readonly T[],keys:readonly string[]=[]):T[]{
 const ranks=new Map<string,number>();keys.forEach((key,index)=>{if(!ranks.has(key))ranks.set(key,index);});
 return items.map((item,index)=>({item,index})).sort((a,b)=>(ranks.get(a.item.id)??Infinity)-(ranks.get(b.item.id)??Infinity)||a.index-b.index).map(row=>row.item);
}
