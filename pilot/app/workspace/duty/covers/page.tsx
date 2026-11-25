import Link from 'next/link';
import {randomUUID} from 'node:crypto';
import {redirect} from 'next/navigation';
import {serverClient} from '../../../../lib/supabase';
import {Submit} from '../../submit';
import {reviewCover} from './actions';
export const dynamic='force-dynamic';
export default async function Covers({searchParams}:{searchParams:Promise<{notice?:string;error?:string}>}){
 if(process.env.PILOT_DUTY_SUBSTITUTES_ENABLED!=='true')redirect('/workspace/duty');
 const params=await searchParams,client=await serverClient(),{data:{user},error}=await client.auth.getUser();if(error||!user)redirect('/login');
 const rooms=await client.from('pilot_classes').select('id,name,enabled_modules'),room=rooms.data?.[0];
 if(!rooms.error&&!room)redirect('/workspace');
 const query=room?client.from('pilot_duty_covers').select('*').eq('class_id',room.id).order('created_at',{ascending:false}).order('id',{ascending:false}).limit(100):null;
 const [covers,students,pending]=await Promise.all([
  query,
  room?client.from('pilot_students').select('id,name,seat,deleted_at').eq('class_id',room.id):null,
  room?client.from('pilot_duty_covers').select('*').eq('class_id',room.id).eq('status','claimed').order('created_at').limit(100):null,
 ]);
 const unavailable=rooms.error||covers?.error||students?.error||pending?.error;
 const records=[...new Map([...(pending?.data??[]),...(covers?.data??[])].map(c=>[c.id,c])).values()];
 const names=new Map((students?.data??[]).map(s=>[s.id,`${s.seat} 號 ${s.name}${s.deleted_at?'（已停用）':''}`]));
 const links=room&&records.length?await client.from('pilot_duty_cover_jobs').select('cover_id,assignment:pilot_duty_assignments(job_name)').eq('class_id',room.id).in('cover_id',records.map(c=>c.id)):null;
 const linkedJobs=(links?.data??[]) as unknown as {cover_id:string;assignment:{job_name:string}|null}[];
 return <main style={{maxWidth:1100,margin:'auto',padding:24,lineHeight:1.7}}><Link href="/workspace/duty">← 值日表</Link><h1>自願代班確認</h1><p>{room?.name} · 接班時不發幣，確認完成後才發放約定金幣，不給 XP。取消已核准代班會扣回原獎勵。</p>
 {params.notice&&<p role="status">已儲存。</p>}{params.error&&<p role="alert">未能儲存，請重新整理，確認學生與獎勵模組狀態後再試。</p>}
 {unavailable||links?.error?<p role="alert">代班紀錄暫時無法載入，暫不開放確認。</p>:<>{!records.length&&<p>目前沒有代班紀錄。</p>}<p>顯示最早 100 筆待確認，以及最近 100 筆紀錄。若待確認達 100 筆，請先處理此批再重新整理。</p>{records.map(c=><article key={c.id} style={{border:'1px solid #cbd5e1',borderRadius:12,padding:20,marginBottom:16}}><h2>{c.day} · {names.get(c.helper_student_id)??'學生'} 幫 {names.get(c.absent_student_id)??'學生'} 代班</h2><p>{linkedJobs.filter(j=>j.cover_id===c.id).map(j=>j.assignment?.job_name).join('、')}</p><p>{c.status==='claimed'?'待老師確認':c.status==='approved'?'已確認完成':'已取消'} · 約定獎勵 {c.coins} 金幣</p>{c.status!=='cancelled'&&<form action={reviewCover}><input type="hidden" name="class" value={room?.id}/><input type="hidden" name="cover" value={c.id}/><input type="hidden" name="version" value={c.version}/><input type="hidden" name="request" value={randomUUID()}/><label><input type="checkbox" name="confirm" value="yes" required/> 我已確認實際工作及此筆處理</label><p>{c.status==='claimed'&&<Submit name="action" value="approve">{`確認完成並發放 ${c.coins} 金幣`}</Submit>} <Submit name="action" value="cancel">{c.status==='approved'?'取消並收回獎勵':'取消代班'}</Submit></p></form>}</article>)}</>}
 </main>;
}
