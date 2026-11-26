'use client';
import {useEffect,useState} from 'react';
import {useRouter} from 'next/navigation';
export function DownloadForm({classId}:{classId:string}){
 const [pending,setPending]=useState(false),[message,setMessage]=useState(''),[ready,setReady]=useState<{url:string;name:string}|null>(null),router=useRouter();
 useEffect(()=>()=>{if(ready)URL.revokeObjectURL(ready.url);},[ready]);
 async function download(){
  setPending(true);setMessage('正在產生班級資料檔並檢查完整性…');
  try{
   const response=await fetch('/workspace/exports/download',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({classId})});
   if(!response.ok){const result=await response.json();throw new Error(typeof result.error==='string'?result.error:'匯出失敗，請稍後重試。');}
   const bytes=await response.arrayBuffer(),hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))).map(b=>b.toString(16).padStart(2,'0')).join('');
   if(hash!==response.headers.get('X-Export-SHA256'))throw new Error('檔案完整性檢查失敗，未開始下載。');
   const disposition=response.headers.get('Content-Disposition')??'',match=/filename="(classroom-[a-f0-9-]+\.json)"/.exec(disposition);
   if(!match)throw new Error('檔名無效，未開始下載。');
   const url=URL.createObjectURL(new Blob([bytes],{type:'application/json'})),link=document.createElement('a');setReady({url,name:match[1]});link.href=url;link.download=match[1];document.body.appendChild(link);link.click();link.remove();
   setMessage('完整性檢查通過，已開始下載。請確認檔案已儲存在你的裝置；產生紀錄不代表已成功保存或完成還原驗證。');router.refresh();
  }catch(error){setMessage(error instanceof Error?error.message:'暫時無法匯出。');}finally{setPending(false);}
 }
 return <><button onClick={()=>void download()} disabled={pending} aria-busy={pending} style={{fontSize:18,padding:'14px 24px'}}>{pending?'準備匯出中…':'下載班級資料檔'}</button>{message&&<p role="status">{message}</p>}{ready&&<p>如果瀏覽器未開始下載，<a href={ready.url} download={ready.name}>下載剛產生的檔案</a>。此連結只在目前頁面保留。</p>}</>;
}
