import Link from 'next/link';
import {redirect} from 'next/navigation';
import {serverClient} from '../../../lib/supabase';
import {PairForm} from './pair-form';
import {revokeDisplay,saveAppearance} from './actions';
import {defaultDisplaySettings,displaySections,type DisplaySettings} from '../../../lib/display-settings';
import {Submit} from '../submit';
export const dynamic='force-dynamic';
export default async function Displays({searchParams}:{searchParams:Promise<{error?:string;notice?:string}>}){
 if(process.env.PILOT_DISPLAY_PAIRING_ENABLED!=='true')redirect('/workspace');
 const params=await searchParams,client=await serverClient(),{data:{user},error}=await client.auth.getUser();if(error||!user)redirect('/login');
 const rooms=await client.from('pilot_classes').select('id,name'),room=rooms.data?.[0];if(!rooms.error&&!room)redirect('/workspace');
 const devices=room?await client.from('pilot_display_devices').select('id,name,paired_at,expires_at,revoked_at,code_expires_at,created_at').eq('class_id',room.id).order('created_at',{ascending:false}).limit(200):null;
 const appearanceReady=process.env.PILOT_DISPLAY_APPEARANCE_ENABLED==='true';
 const saved=room&&appearanceReady?await client.from('pilot_display_settings').select('base_font,visible_sections,version').eq('class_id',room.id).maybeSingle():null;
 const appearance=(saved?.data??defaultDisplaySettings) as DisplaySettings;
 return <main style={{maxWidth:900,margin:'auto',padding:24,lineHeight:1.8}}><Link href="/workspace">← 工作台</Link><h1>白板配對</h1><p>{room?.name}</p><p>每班最多 5 台有效裝置。配對碼 10 分鐘有效，白板授權 90 天有效；撤銷後立即停止使用。請在教室白板完成配對。{process.env.PILOT_DISPLAY_SHOP_ENABLED==='true'?'配對白板已可使用班級商店；其他學生操作仍在開發。':'此階段只驗證連線，尚無學生資料或操作。'}</p>
 {params.error&&<p role="alert">操作失敗，請重新整理後重試。</p>}{params.notice&&<p role="status">{params.notice==='appearance'?'大屏畫面設定已儲存，請重新整理大屏。':'裝置授權已撤銷。'}</p>}
 {appearanceReady&&room&&(saved?.error?<p role="alert">畫面設定暫時無法讀取，不提供覆寫。</p>:<section><h2>大屏文字與底部分頁</h2><form action={saveAppearance}><input type="hidden" name="classId" value={room.id}/><input type="hidden" name="version" value={appearance.version}/><label>基準字級（16～32 px） <input type="number" name="font" min={16} max={32} step={1} required defaultValue={appearance.base_font}/></label><p>預設 22 px。調整文字，不縮放整個畫面；長內容會在區塊內捲動。請以電子白板實際觀看距離確認。</p><fieldset><legend>底部分頁顯示</legend>{displaySections.map(s=><label key={s.id} style={{display:'inline-block',marginRight:16}}><input type="checkbox" name="section" value={s.id} defaultChecked={appearance.visible_sections.includes(s.id)}/>{s.label}</label>)}</fieldset><p>僅控制下方按鈕顯示；未啟用的功能不會因此開啟，也不會改變學生的操作權限。午餐分頁仍在開發，完成後才會出現。</p><Submit>儲存大屏畫面設定</Submit></form></section>)}
 {rooms.error||devices?.error?<p role="alert">讀取失敗，不提供操作。</p>:<><PairForm classId={room!.id}/><h2>裝置紀錄</h2>{!devices?.data?.length&&<p>尚無配對紀錄。</p>}{devices?.data?.map(d=>{const expired=new Date(d.expires_at??d.code_expires_at).getTime()<=Date.now();return <article key={d.id} style={{borderBottom:'1px solid #cbd5e1',padding:12}}><h3>{d.name}</h3><p>{d.revoked_at?'已撤銷':expired?'已到期':d.paired_at?'已配對':'等待配對'}</p>{d.paired_at&&<p>配對於 {new Date(d.paired_at).toLocaleString('zh-TW',{timeZone:'Asia/Taipei'})}</p>}{!d.revoked_at&&<form action={revokeDisplay}><input type="hidden" name="classId" value={room!.id}/><input type="hidden" name="deviceId" value={d.id}/><label><input type="checkbox" name="confirm" value="yes" required/>確認撤銷此裝置</label> <Submit>撤銷授權</Submit></form>}</article>;})}</>}
 </main>;
}
