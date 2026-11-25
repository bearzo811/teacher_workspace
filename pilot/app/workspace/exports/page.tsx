import Link from 'next/link';
import {redirect} from 'next/navigation';
import {serverClient} from '../../../lib/supabase';
import {taipeiToday} from '../../../lib/calendar';
import {taipeiTimestamp} from '../../../lib/time';
import {DownloadForm} from './download-form';
import {FileCheck} from './file-check';
export const dynamic='force-dynamic';
export default async function Exports(){
 if(process.env.PILOT_CLASS_EXPORTS_ENABLED!=='true')redirect('/workspace');
 const client=await serverClient(),{data:{user},error}=await client.auth.getUser();if(error||!user)redirect('/login');
 const rooms=await client.from('pilot_classes').select('id,name,enabled_modules'),room=rooms.data?.[0];if(!rooms.error&&!room)redirect('/workspace');
 const modules=room?.enabled_modules??[],today=taipeiToday();
 const [students,terms,books,rules,devices,history]=room?await Promise.all([
  client.from('pilot_students').select('id',{count:'exact',head:true}).eq('class_id',room.id).is('deleted_at',null),
  client.from('pilot_terms').select('id,name,start_date,end_date').eq('class_id',room.id).eq('active',true).maybeSingle(),
  modules.includes('homework')?client.from('pilot_workbooks').select('id',{count:'exact',head:true}).eq('class_id',room.id).eq('archived',false):Promise.resolve(null),
  modules.includes('rewards')?client.from('pilot_reward_rules').select('version').eq('class_id',room.id).maybeSingle():Promise.resolve(null),
  client.from('pilot_display_devices').select('id',{count:'exact',head:true}).eq('class_id',room.id).not('paired_at','is',null).is('revoked_at',null).gt('expires_at',new Date().toISOString()),
  client.from('pilot_class_exports').select('id,bytes,sha256,counts,created_at').eq('class_id',room.id).order('created_at',{ascending:false}).limit(5),
 ]):[null,null,null,null,null,null];
 const term=terms?.data;
 const plans=room&&term&&modules.includes('duty')?await client.from('pilot_duty_plans').select('id',{count:'exact',head:true}).eq('class_id',room.id).eq('term_id',term.id).lte('effective_from',today<term.start_date?term.start_date:today>term.end_date?term.end_date:today):null;
 const unavailable=rooms.error||students?.error||terms?.error||books?.error||rules?.error||devices?.error||history?.error||plans?.error;
 const checks=[
  {name:'學生名冊',ok:!!students?.count&&students.count<=15,detail:`${students?.count??0} 位使用中學生`,href:'/workspace'},
  {name:'啟用學期',ok:!!term,detail:term?`${term.name} · ${term.start_date}～${term.end_date}`:'尚未啟用學期',href:'/workspace/calendar'},
  ...(modules.includes('homework')?[{name:'作業簿本',ok:!!books?.count,detail:`${books?.count??0} 本使用中簿本`,href:'/workspace/workbooks'}]:[]),
  ...(modules.includes('rewards')?[{name:'已確認獎勵規則',ok:!!rules?.data,detail:rules?.data?`規則版本 ${rules.data.version}`:'請先檢查並確認金幣／XP 規則',href:'/workspace/rewards/rules'}]:[]),
  ...(modules.includes('duty')?[{name:'已發布值日表',ok:!!plans?.count,detail:plans?.count?'請再檢查月表與工作分配':'尚無適用日期的已發布輪排',href:'/workspace/duty'}]:[]),
  {name:'已配對教室白板',ok:!!devices?.count,detail:`${devices?.count??0} 台有效白板`,href:'/workspace/displays'},
 ];
 return <main style={{maxWidth:1000,margin:'auto',padding:24,lineHeight:1.8}}><Link href="/workspace">← 工作台</Link><h1>開學前檢查／資料匯出</h1><p>{room?.name} · {today}</p>
 {unavailable?<p role="alert">資料暫時無法完整讀取，暫不顯示檢查結果或下載按鈕，請重新整理。</p>:<><h2>設定檢查</h2><p>這裡檢查目前設定。還需要在實際電子白板測試字級、觸控、聲音、學生任務與商店操作。</p><ul>{checks.map(check=><li key={check.name}><strong>{check.ok?'✓':'待確認'} · {check.name}</strong>：{check.detail} <Link href={check.href}>前往設定</Link></li>)}</ul><h2>下載班級資料</h2><p>包含所有學期、已移除學生、作業與學習紀錄、出缺席、值日與代班、金幣帳本、商品背包及班級設定。也包含目前關閉模組的既有紀錄；不包含登入資料、白板配對憑證或系統私密設定。</p><p>檔案含學生資料，請保存在你能控制的裝置。這是手動資料匯出，目前尚未提供自動備份與匯入還原；檔案會先通過完整性檢查，超過 3 MB 或 50,000 筆時會停止匯出，避免產生不完整檔案。</p><DownloadForm classId={room!.id}/><FileCheck classId={room!.id} receipts={(history?.data??[]).map(row=>({id:row.id,bytes:row.bytes,sha256:row.sha256,counts:row.counts as Record<string,number>}))}/><h2>最近產生的匯出</h2><p>以下記錄代表伺服器產生過檔案，請另外確認檔案確實已下載保存。</p>{!history?.data?.length?<p>尚未產生匯出。</p>:<ul>{history.data.map(record=><li key={record.id} style={{marginBottom:12}}>{taipeiTimestamp(record.created_at)} · {(record.bytes/1024).toFixed(1)} KB · {Object.values(record.counts as Record<string,number>).reduce((n,v)=>n+v,0)} 筆<details><summary>查看檔案指紋</summary><code style={{overflowWrap:'anywhere'}}>{record.sha256}</code></details></li>)}</ul>}</>}
 </main>;
}
