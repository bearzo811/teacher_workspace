"use client";
import {useActionState} from 'react';
import {createPairing,type PairingState} from './actions';
export function PairForm({classId}:{classId:string}){
 const [state,action,pending]=useActionState<PairingState,FormData>(createPairing,{});
 return <><form action={action}><input type="hidden" name="classId" value={classId}/><label>白板名稱 <input name="name" maxLength={60} required defaultValue="教室白板"/></label> <button disabled={pending}>{pending?'建立中…':'建立一次性配對碼'}</button></form>
 {state.error&&<p role="alert">{state.error}</p>}{state.code&&<section role="status"><p>在白板開啟本站的 /display/pair，貼上以下配對碼。請勿分享給其他人。</p><p style={{fontSize:24,overflowWrap:'anywhere',userSelect:'all'}}>{state.code}</p><p>有效至 {new Date(state.expires!).toLocaleString('zh-TW',{timeZone:'Asia/Taipei',hour12:false})}，只能使用一次。離開此頁後不再顯示。</p></section>}</>;
}
