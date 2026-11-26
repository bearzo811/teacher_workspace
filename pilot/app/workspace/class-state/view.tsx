import Link from 'next/link';
import {randomUUID} from 'node:crypto';
import {Submit} from '../submit';
import {changeClassState} from './actions';
export type Paused={id:string;name:string;paused_at:string};
export function ClassStateView({room,records,unavailable=false,params={},preview=false}:{room?:{id:string;name:string};records:Paused[];unavailable?:boolean;params?:{notice?:string;error?:string};preview?:boolean}){
 const section={border:'1px solid #cbd5e1',borderRadius:12,padding:20,marginTop:20};
 const fields=(id:string,mode:'pause'|'resume',stamp:string)=><><input type="hidden" name="class" value={id}/><input type="hidden" name="mode" value={mode}/><input type="hidden" name="pausedAt" value={stamp}/><input type="hidden" name="request" value={randomUUID()}/><p><label>操作原因 <input name="note" maxLength={200} required/></label></p><p><label><input type="checkbox" name="confirm" value="yes" required/>{mode==='pause'?'我已確認暫停此班，白板需重新配對，商店與自動獎勵需要另外重新開啟。':'我已確認復原此班，之後會重新檢查白板、商店與獎勵設定。'}</label></p><Submit>{mode==='pause'?'確認暫停班級':'復原此班級'}</Submit></>;
 return <main style={{maxWidth:950,padding:24,margin:'auto',lineHeight:1.8}}><Link href="/workspace">← 工作台</Link><h1>班級暫停與復原</h1><p>暫停後資料仍保留，不刪除學生、作業、帳本或背包。這不是帳號刪除，也不會排程清除資料。</p><p>暫停會撤銷全部白板授權及配對碼，關閉商店、自動獎勵與逾期扣點。復原只恢復班級；白板需重新配對，各獎勵／商店開關需由老師另外確認。</p>
 {params.notice&&<p role="status">{params.notice==='pause'?'班級已暫停，資料保留。':'班級已復原；請重新檢查各項設定。'}</p>}{params.error&&<p role="alert">{params.error==='changed'?'班級狀態已變更，請重新整理後確認。':'未能儲存，請確認原因與勾選確認；若已有另一個使用中班級，須先暫停該班才能復原。'}</p>}
 {unavailable?<p role="alert">班級狀態無法完整載入，暫不提供操作。</p>:<><section style={section}><h2>使用中班級</h2>{room?<><h3>{room.name}</h3><p>暫停前可先到<Link href="/workspace/exports">資料匯出</Link>下載一份檔案；暫停期間不提供編輯或匯出。</p><form action={changeClassState}><fieldset disabled={preview} style={{border:0,padding:0}}>{fields(room.id,'pause','')}</fieldset></form></>:<p>目前沒有使用中的班級，可從下方復原，或回工作台建立新班。</p>}</section><section style={section}><h2>已暫停班級</h2>{!records.length&&<p>目前沒有已暫停班級。</p>}{records.map(record=><article key={record.id} style={{borderTop:'1px solid #cbd5e1',paddingTop:12}}><h3>{record.name}</h3><p>暫停時間：{new Date(record.paused_at).toLocaleString('zh-TW',{timeZone:'Asia/Taipei',hour12:false})}</p>{room?<p>每人只能有一個使用中班級，請先暫停上方班級再復原。</p>:<form action={changeClassState}><fieldset disabled={preview} style={{border:0,padding:0}}>{fields(record.id,'resume',record.paused_at)}</fieldset></form>}</article>)}</section></>}
 </main>;
}
