"use client";
import {useState,useRef,type PointerEvent} from 'react';
import {saveDebtOrder} from './actions';
import {Submit} from '../submit';
export function OrderEditor({classroom,student,term,items,showMore,version,preview=false}:{classroom:string;student:string;term:string;items:{id:string;label:string}[];showMore:boolean;version:number;preview?:boolean}){
 const [order,setOrder]=useState(items),[dragged,setDragged]=useState<string|null>(null),[over,setOver]=useState<string|null>(null),[expanded,setExpanded]=useState(false),[announcement,setAnnouncement]=useState(''),[useDefault,setUseDefault]=useState(false);
 const drag=useRef<{id:string;pointer:number}|null>(null);
 function target(event:PointerEvent<HTMLButtonElement>){
  const row=document.elementFromPoint(event.clientX,event.clientY)?.closest<HTMLElement>('[data-debt-key]');
  return row&&event.currentTarget.closest('ol')?.contains(row)?row.dataset.debtKey??null:null;
 }
 function cancel(){drag.current=null;setDragged(null);setOver(null);}
 function move(id:string,index:number){setUseDefault(false);setOrder(current=>{const item=current.find(x=>x.id===id);if(!item)return current;const next=current.filter(x=>x.id!==id);next.splice(index,0,item);return next;});setAnnouncement(`已移到第 ${index+1} 項，請儲存。`);}
 return <section><button type="button" aria-expanded={expanded} onClick={()=>setExpanded(value=>!value)}>調整這位學生的大屏優先順序</button><div hidden={!expanded}><p>拖曳把手調整排序，也可用位置選單。沒有自訂時，以最新作業、護照、閱讀／讀報排序。已完成或刪除的項目會自動略過。</p>
 <form action={saveDebtOrder} onSubmit={preview?event=>event.preventDefault():undefined}><input type="hidden" name="class" value={classroom}/><input type="hidden" name="student" value={student}/><input type="hidden" name="term" value={term}/><input type="hidden" name="version" value={version}/><input type="hidden" name="keys" value={JSON.stringify(useDefault?[]:order.map(x=>x.id))}/>
 <ol style={{paddingLeft:28}}>{order.map((item,index)=><li key={item.id} data-debt-key={item.id} style={{padding:10,marginBottom:8,border:over===item.id?'2px solid #2563eb':'2px solid #cbd5e1',borderRadius:8,background:dragged===item.id?'#dbeafe':'#fff'}}>
 <button type="button" aria-label={`拖曳${item.label}`} aria-pressed={dragged===item.id} style={{touchAction:'none',cursor:dragged===item.id?'grabbing':'grab',padding:'8px 12px',marginRight:8,border:'1px solid #94a3b8',borderRadius:6,background:'#f1f5f9',fontSize:20}}
 onPointerDown={event=>{if(!event.isPrimary||event.button!==0)return;event.preventDefault();drag.current={id:item.id,pointer:event.pointerId};setDragged(item.id);setOver(item.id);event.currentTarget.setPointerCapture(event.pointerId);}}
 onPointerMove={event=>{if(drag.current?.pointer!==event.pointerId)return;setOver(target(event));if(event.clientY<60)window.scrollBy(0,-12);else if(event.clientY>window.innerHeight-60)window.scrollBy(0,12);}}
 onPointerUp={event=>{if(drag.current?.pointer!==event.pointerId)return;const id=target(event),destination=order.findIndex(row=>row.id===id);if(destination>=0)move(drag.current.id,destination);cancel();if(event.currentTarget.hasPointerCapture(event.pointerId))event.currentTarget.releasePointerCapture(event.pointerId);}}
 onPointerCancel={cancel} onLostPointerCapture={cancel}><span aria-hidden>⠿</span></button>{item.label}<label style={{display:'block',fontSize:14}}>位置 <select aria-label={`${item.label}的位置`} value={index} onChange={event=>move(item.id,Number(event.target.value))}>{order.map((_,position)=><option key={position} value={position}>{position+1}</option>)}</select></label></li>)}</ol>
 <p role="status" aria-live="polite">{announcement}</p><label><input type="checkbox" name="show_more" value="yes" defaultChecked={showMore}/> 大屏顯示後面兩項待完成事項</label><p><button type="button" onClick={()=>{setUseDefault(false);setOrder(items);setAnnouncement('已還原本次載入順序，請儲存。');}}>還原本次排序</button> <button type="button" onClick={()=>{setUseDefault(true);setAnnouncement('已改回系統預設，請儲存。');}}>使用系統預設順序</button></p>{preview?<button disabled>僅排版預覽</button>:<Submit>儲存個人顯示設定</Submit>}
 </form></div></section>;
}
