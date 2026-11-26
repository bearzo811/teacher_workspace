"use client";
import Link from 'next/link';
export default function ErrorPage({reset}:{reset:()=>void}){return <main style={{maxWidth:800,margin:'auto',padding:24,lineHeight:1.8}}><h1>這個頁面暫時無法載入</h1><p role="alert">班級資料沒有完整載入。請重試；若剛送出操作，重新載入後先核對最後紀錄。</p><button type="button" onClick={reset} style={{padding:'12px 24px',fontSize:18}}>重新載入這個頁面</button><p><Link href="/workspace">返回工作台</Link> · <Link href="/guide">查看操作導覽</Link></p></main>;}
