"use client";
import {useState} from 'react';
import {saveDebtOrder} from './actions';
import {Submit} from '../submit';
export function OrderEditor({classroom,student,term,items,showMore,version,preview=false}:{classroom:string;student:string;term:string;items:{id:string;label:string}[];showMore:boolean;version:number;preview?:boolean}){
 const [order,setOrder]=useState(items),[dragged,setDragged]=useState<string|null>(null),[announcement,setAnnouncement]=useState(''),[useDefault,setUseDefault]=useState(false);
 function move(id:string,index:number){setUseDefault(false);setOrder(current=>{const item=current.find(x=>x.id===id);if(!item)return current;const next=current.filter(x=>x.id!==id);next.splice(index,0,item);return next;});setAnnouncement(`已移到第 ${index+1} 項，請儲存。`);}
 return <details><summary>調整這位學生的大屏優先順序</summary><p>拖曳項目排序。沒有自訂時，以最新作業、護照、閱讀／讀報排序。已完成或刪除的項目會自動略過。</p>
 <form action={saveDebtOrder} onSubmit={preview?event=>event.preventDefault():undefined}><input type="hidden" name="class" value={classroom}/><input type="hidden" name="student" value={student}/><input type="hidden" name="term" value={term}/><input type="hidden" name="version" value={version}/><input type="hidden" name="keys" value={JSON.stringify(useDefault?[]:order.map(x=>x.id))}/>
 <ol style={{paddingLeft:28}}>{order.map((item,index)=><li key={item.id} draggable onDragStart={event=>{setDragged(item.id);event.dataTransfer.effectAllowed='move';event.dataTransfer.setData('text/plain',item.id);}} onDragEnd={()=>setDragged(null)} onDragOver={event=>event.preventDefault()} onDrop={event=>{event.preventDefault();if(dragged)move(dragged,index);setDragged(null);}} style={{padding:10,marginBottom:8,border:'1px solid #cbd5e1',borderRadius:8,cursor:'grab',background:dragged===item.id?'#dbeafe':'#fff'}}>
 <span aria-hidden>⠿ </span>{item.label}<label style={{display:'block',fontSize:14}}>位置 <select aria-label={`${item.label}的位置`} value={index} onChange={event=>move(item.id,Number(event.target.value))}>{order.map((_,position)=><option key={position} value={position}>{position+1}</option>)}</select></label></li>)}</ol>
 <p role="status" aria-live="polite">{announcement}</p><label><input type="checkbox" name="show_more" value="yes" defaultChecked={showMore}/> 大屏顯示後面兩項待完成事項</label><p><button type="button" onClick={()=>{setUseDefault(false);setOrder(items);setAnnouncement('已還原本次載入順序，請儲存。');}}>還原本次排序</button> <button type="button" onClick={()=>{setUseDefault(true);setAnnouncement('已改回系統預設，請儲存。');}}>使用系統預設順序</button></p>{preview?<button disabled>僅排版預覽</button>:<Submit>儲存個人顯示設定</Submit>}
 </form></details>;
}
