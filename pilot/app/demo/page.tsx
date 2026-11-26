import Link from 'next/link';
import {Demo} from './view';
export default function DemoPage(){return <main style={{maxWidth:1100,padding:24,margin:'auto',lineHeight:1.8}}><Link href="/">← 首頁</Link><h1>先試玩一個班級</h1><p>這裡全部是虛構資料，不需登入、不連接班級資料庫。所有操作只在目前頁面模擬，重新整理或重設即可重新開始。</p><Demo/><p><Link href="/login">準備好了，使用 Google 建立自己的班級</Link></p></main>;}
