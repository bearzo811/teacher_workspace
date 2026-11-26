import Link from 'next/link';
import {redirect} from 'next/navigation';
import {randomUUID} from 'node:crypto';
import {serverClient} from '../../../../lib/supabase';
import {moduleEnabled} from '../../../../lib/modules';
import {backpackPage} from '../../../../lib/backpack';
import {Submit} from '../../submit';
import {manageReward} from '../actions';
export const dynamic='force-dynamic';
export default async function Requests({searchParams}:{searchParams:Promise<{page?:string;notice?:string;error?:string}>}){
 if(process.env.PILOT_BACKPACK_ENABLED!=='true')redirect('/workspace');
 const params=await searchParams,page=backpackPage(params.page),client=await serverClient(),{data:{user},error}=await client.auth.getUser();if(error||!user)redirect('/login');
 const rooms=await client.from('pilot_classes').select('id,name,enabled_modules'),room=rooms.data?.[0];if(!rooms.error&&!room)redirect('/workspace');
 const enabled=moduleEnabled(room?.enabled_modules,'rewards');
 const [pending,students]=enabled&&page&&room?await Promise.all([
  client.from('pilot_student_rewards').select('id,student_id,item_name,item_icon,source,version,requested_at',{count:'exact'}).eq('class_id',room.id).eq('status','requested').order('requested_at').order('id').range((page-1)*50,page*50-1),
  client.from('pilot_students').select('id,name,seat,deleted_at').eq('class_id',room.id),
 ]):[null,null];
 const unavailable=rooms.error||pending?.error||students?.error,total=pending?.count??0,names=new Map((students?.data??[]).map(s=>[s.id,s]));
 return <main style={{maxWidth:1100,margin:'auto',padding:24,lineHeight:1.8}}><Link href="/workspace/today">← Today</Link> · <Link href="/workspace/backpacks">學生背包</Link><h1>全班待核銷獎品</h1><p>{room?.name} · 依申請時間由早到晚顯示。確認獎品已使用才核銷，不會再次扣金幣或庫存。</p>
 {params.notice&&<p role="status">已完成處理。</p>}{params.error&&<p role="alert">未能儲存，請重新整理並確認獎品狀態。</p>}
 {unavailable?<p role="alert">待核銷資料無法完整載入，暫不提供操作。</p>:!enabled?<p>請先開啟金幣與商店模組。</p>:!page?<p role="alert">分頁無效，請<Link href="/workspace/backpacks/requests">回到第一頁</Link>。</p>:<><p>共 {total} 件 · 第 {page}／{Math.max(1,Math.ceil(total/50))} 頁</p>{!total&&<p>目前沒有待核銷獎品。</p>}
 <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(min(100%,300px),1fr))',gap:16}}>{pending?.data?.map(reward=>{const student=names.get(reward.student_id),canManage=student&&!student.deleted_at&&(reward.source==='gift'||process.env.PILOT_PURCHASE_FULFILLMENT_ENABLED==='true');return <article key={reward.id} style={{border:'1px solid #cbd5e1',borderRadius:10,padding:16}}><h2>{student?`${student.seat} 號 ${student.name}`:'學生資料無法識別'}{student?.deleted_at?'（已移除）':''}</h2><h3>{reward.item_icon} {reward.item_name}</h3><p>申請時間：{new Date(reward.requested_at).toLocaleString('zh-TW',{timeZone:'Asia/Taipei',hour12:false})}</p>{canManage?<form action={manageReward}><input type="hidden" name="classId" value={room!.id}/><input type="hidden" name="studentId" value={reward.student_id}/><input type="hidden" name="rewardId" value={reward.id}/><input type="hidden" name="requestId" value={randomUUID()}/><input type="hidden" name="version" value={reward.version}/><input type="hidden" name="page" value="1"/><input type="hidden" name="returnTo" value="requests"/><p><label>處理方式 <select name="action"><option value="redeem">確認已使用</option><option value="return">退回可使用</option></select></label></p><p><label>處理說明 <input name="note" maxLength={200} required/></label></p><p><label><input type="checkbox" name="confirm" value="yes" required/>我已確認學生、獎品與實際使用情形</label></p><Submit>確認處理</Submit></form>:<p>請先復原學生或確認已購獎品處理功能已啟用。</p>}{student&&!student.deleted_at&&<Link href={`/workspace/backpacks?student=${student.id}&reward=${reward.id}`}>查看獎品操作紀錄</Link>}</article>;})}</div>
 <p>{page>1&&<Link href={`/workspace/backpacks/requests?page=${page-1}`}>上一頁</Link>}　{page*50<total&&<Link href={`/workspace/backpacks/requests?page=${page+1}`}>下一頁</Link>}</p></>}
 </main>;
}
