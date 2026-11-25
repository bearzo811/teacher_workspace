'use client';
import {useState} from 'react';
import {useRouter} from 'next/navigation';
export function DownloadForm({classId}:{classId:string}){
 const [pending,setPending]=useState(false),[message,setMessage]=useState(''),router=useRouter();
 async function download(){
  setPending(true);setMessage('正在產生班級資料檔並檢查完整性…');
  try{
   const response=await fetch('/workspace/exports/download',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({classId})});
   if(!response.ok){const result=await response.json();throw new Error(typeof result.error==='string'?result.error:'匯出失敗，請稍後重試。');}
   const bytes=await response.arrayBuffer(),hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))).map(b=>b.toString(16).padStart(2,'0')).join('');
   if(hash!==response.headers.get('X-Export-SHA256'))throw new Error('檔案完整性檢查失敗，未開始下載。');
   const disposition=response.headers.get('Content-Disposition')??'',match=/filename="(classroom-[a-f0-9-]+\.json)"/.exec(disposition);
   if(!match)throw new Error('檔名無效，未開始下載。');
   const url=URL.createObjectURL(new Blob([bytes],{type:'application/json'})),link=document.createElement('a');link.href=url;link.download=match[1];document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),5000);
   setMessage('完整性檢查通過，已開始下載。請確認檔案已儲存在你的裝置；產生紀錄不代表已成功保存或完成還原驗證。');router.refresh();
  }catch(error){setMessage(error instanceof Error?error.message:'暫時無法匯出。');}finally{setPending(false);}
 }
 return <><button onClick={()=>void download()} disabled={pending} aria-busy={pending} style={{fontSize:18,padding:'14px 24px'}}>{pending?'準備匯出中…':'下載班級資料檔'}</button>{message&&<p role="status">{message}</p>}</>;
}
