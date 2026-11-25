'use client';
import {useState,type ChangeEvent} from 'react';
import {maxExportBytes,inspectClassExport,type ClassExport} from '../../../lib/class-export';
type Receipt=Omit<ClassExport,'payload'>;
export function FileCheck({classId,receipts}:{classId:string;receipts:Receipt[]}){
 const [pending,setPending]=useState(false),[message,setMessage]=useState('');
 async function check(event:ChangeEvent<HTMLInputElement>){
  const file=event.target.files?.[0];if(!file)return;
  setPending(true);setMessage('正在本機檢查檔案…');
  try{
   if(file.size>maxExportBytes)throw new Error('檔案超過目前檢查容量。');
   const bytes=await file.arrayBuffer(),payload=new TextDecoder('utf-8',{fatal:true}).decode(bytes),snapshot=JSON.parse(payload),receipt=receipts.find(row=>row.id===snapshot.export_id);
   if(!receipt)throw new Error('找不到這份檔案的最近產生紀錄；目前只能核對本班最近五份匯出。');
   const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))).map(b=>b.toString(16).padStart(2,'0')).join('');
   if(hash!==receipt.sha256)throw new Error('檔案指紋與產生紀錄不同，可能選錯檔案或內容已被修改。');
   const result=inspectClassExport({...receipt,payload},classId);
   if(result.problems.length)throw new Error(result.problems.join(' '));
   setMessage(`檢查通過：${result.students} 位學生（含已移除）、${result.rows} 筆紀錄；檔案指紋、筆數及帳本餘額一致。尚未實際還原，仍需隔離環境的還原驗證。`);
  }catch(error){setMessage(error instanceof Error?error.message:'檔案無法讀取。');}finally{setPending(false);}
 }
 return <section><h2>檢查已下載的檔案</h2><p>選擇剛下載的 JSON 檔，核對最近五份產生紀錄、名冊與金幣／XP 帳本。檔案只在此裝置檢查，不會上傳。</p><label>選擇匯出檔 <input type="file" accept=".json,application/json" disabled={pending||!receipts.length} onChange={event=>void check(event)}/></label>{message&&<p role="status">{message}</p>}</section>;
}
