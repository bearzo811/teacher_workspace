import Link from 'next/link';
import {randomUUID} from 'node:crypto';
import {redirect} from 'next/navigation';
import {serverClient} from '../../../lib/supabase';
import {Submit} from '../submit';
import {saveLunchMedia} from './actions';
export const dynamic='force-dynamic';
export default async function Media({searchParams}:{searchParams:Promise<{notice?:string;error?:string}>}){
 if(process.env.PILOT_LUNCH_MEDIA_ENABLED!=='true')redirect('/workspace');
 const params=await searchParams,client=await serverClient(),{data:{user},error}=await client.auth.getUser();if(error||!user)redirect('/login');
 const rooms=await client.from('pilot_classes').select('id,name,enabled_modules'),room=rooms.data?.[0];if(!rooms.error&&!room)redirect('/workspace');
 const result=room?await client.from('pilot_lunch_media').select('video_id,title,version').eq('class_id',room.id).maybeSingle():null;
 const current=result?.data,unavailable=rooms.error||result?.error;
 const fields=(request:string)=><><input type="hidden" name="class" value={room?.id}/><input type="hidden" name="version" value={current?.version??0}/><input type="hidden" name="request" value={request}/></>;
 return <main style={{maxWidth:900,margin:'auto',padding:24,lineHeight:1.8}}><Link href="/workspace">← 工作台</Link><h1>午餐點歌／影音</h1><p>{room?.name}</p><p>學生使用點歌獎品後，由老師選好影片、貼上 YouTube 連結。午餐頁會在約 10 秒內切換為滿版影片；播放結束後自動清空，回到工作與生活任務。</p><p>播放會連線至 YouTube；若瀏覽器阻擋自動播放，請點播放器的播放鍵。歌名是備註，不能取代影片連結。</p>
 {params.notice&&<p role="status">影音設定已儲存。</p>}{params.error&&<p role="alert">未能儲存。請確認是影片連結，或重新整理取得最新設定再試。</p>}
 {unavailable?<p role="alert">影音設定暫時無法載入，暫不開放修改。</p>:<><p>目前：{current?.video_id?current.title||'已指定影片':'沒有播放中的影片'}</p><form action={saveLunchMedia} style={{display:'grid',gap:16}}>{fields(randomUUID())}<input type="hidden" name="action" value="set"/><label>歌名／影片名稱（選填，最多 120 字）<input name="title" maxLength={120} defaultValue={current?.title??''} style={{width:'100%',padding:10,boxSizing:'border-box'}}/></label><label>YouTube 影片連結（必填）<input name="url" type="url" required defaultValue={current?.video_id?`https://www.youtube.com/watch?v=${current.video_id}`:''} placeholder="https://www.youtube.com/watch?v=…" style={{width:'100%',padding:10,boxSizing:'border-box'}}/></label><Submit pendingLabel="設定播放中…">儲存並播放</Submit></form>{current?.video_id&&<form action={saveLunchMedia} style={{marginTop:20}}>{fields(randomUUID())}<input type="hidden" name="action" value="stop"/><Submit pendingLabel="停止中…">停止並清空影音</Submit></form>}</>}
 </main>;
}
