import {displayText} from '../../../lib/display-settings';
import Link from 'next/link';
import {cookies} from 'next/headers';
import {redirect} from 'next/navigation';
import {randomUUID} from 'node:crypto';
import {displayClient,displayCookie} from '../../../lib/display';
import {backpackPage,rewardStates,type RewardState} from '../../../lib/backpack';
import {Submit} from '../../workspace/submit';
import {requestRewardUse} from './actions';
export const dynamic='force-dynamic';
type Backpack={enabled:boolean;students:{id:string;seat:number;name:string}[];total:number;rewards:{id:string;item_name:string;item_icon:string;description:string;status:RewardState;version:number}[]};
export default async function BackpackPage({searchParams}:{searchParams:Promise<{student?:string;page?:string;error?:string;notice?:string;reward?:string}>}){
 if(process.env.PILOT_DISPLAY_BACKPACK_ENABLED!=='true')redirect('/display');
 const params=await searchParams,token=(await cookies()).get(displayCookie)?.value;if(!token)redirect('/display/pair');
 const page=backpackPage(params.page),student=params.student&&/^[a-f0-9-]{36}$/i.test(params.student)?params.student:null;
 if(page===null)return <main><p>頁碼無效。</p><Link href="/display/backpack">重新選擇</Link></main>;
 const result=await displayClient().rpc('get_pilot_display_backpack',{device_token:token,selected_student:student,target_page:page});
 if(result.error)return <main style={{padding:32}}><h1>背包暫時無法開啟</h1><p>請重新選擇學生，或請老師確認白板授權。</p><Link href="/display/backpack">重新選擇</Link> · <Link href="/display/pair">白板配對</Link></main>;
 const data=result.data as Backpack,selected=data.students.find(s=>s.id===student);
 return <main style={{height:'100%',display:'flex',flexDirection:'column',padding:24,boxSizing:'border-box',background:'#071020',color:'#eef5ff',fontSize:displayText(20),gap:16}}><header style={{flexShrink:0}}><Link href="/display" style={{color:'#a5d8ff'}}>← 白板</Link><h1>我的背包</h1>{params.notice==='requested'&&data.rewards.some(r=>r.id===params.reward&&r.status==='requested')&&<p role="status" style={{color:'#6ee7b7'}}>已提出使用申請，請等老師確認。</p>}{params.error&&<p role="alert" style={{color:'#fda4af'}}>未能提出申請。請重新整理，確認這份獎品仍可使用。</p>}
 {!data.enabled?<p>本班尚未開啟背包模組。</p>:<form method="get"><label>我是 <select name="student" defaultValue={student??''} style={{fontSize:'inherit'}} required><option value="" disabled>選自己的座號</option>{data.students.map(s=><option key={s.id} value={s.id}>{s.seat} 號 {s.name}</option>)}</select></label> <button style={{fontSize:'inherit'}}>查看背包</button></form>}
 {selected&&<p>{selected.name} · 共 {data.total} 份獎品，永久保存。使用申請由老師確認，不會再次扣金幣。</p>}</header>
 <section aria-label="背包獎品" style={{minHeight:0,overflowY:'auto',flex:1,display:'grid',gridTemplateColumns:'repeat(4,minmax(0,1fr))',alignContent:'start',gap:16}}>{selected&&!data.rewards.length&&<p>本頁沒有獎品。</p>}{data.rewards.map(r=><article key={r.id} style={{border:'1px solid #475569',borderRadius:12,padding:16,background:'#111e33',overflowWrap:'anywhere'}}><h2 style={{fontSize:displayText(26)}}>{r.item_icon} {r.item_name}</h2><strong>{rewardStates[r.status]}</strong><p style={{whiteSpace:'pre-wrap'}}>{r.description}</p>{r.status==='available'&&<form action={requestRewardUse}><input type="hidden" name="student" value={student!}/><input type="hidden" name="reward" value={r.id}/><input type="hidden" name="request" value={randomUUID()}/><input type="hidden" name="version" value={r.version}/><input type="hidden" name="page" value={page}/><Submit pendingLabel="申請中…" fontSize={displayText(22)}>申請使用</Submit></form>}</article>)}</section>
 {selected&&<nav aria-label="背包分頁" style={{flexShrink:0}}>{page>1&&<Link style={{color:'#a5d8ff'}} href={`/display/backpack?student=${student}&page=${page-1}`}>上一頁</Link>} 第 {page} 頁 {page*50<data.total&&page<20&&<Link style={{color:'#a5d8ff'}} href={`/display/backpack?student=${student}&page=${page+1}`}>下一頁</Link>}</nav>}
 </main>;
}
