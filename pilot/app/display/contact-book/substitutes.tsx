import {randomUUID} from 'node:crypto';
import {cookies} from 'next/headers';
import {redirect} from 'next/navigation';
import {revalidatePath} from 'next/cache';
import {displayClient,displayCookie} from '../../../lib/display';
import {displayText} from '../../../lib/display-settings';
import {Submit} from '../../workspace/submit';
async function volunteer(form:FormData){
 'use server';
 if(process.env.PILOT_DUTY_SUBSTITUTES_ENABLED!=='true')redirect('/display/contact-book');
 const token=(await cookies()).get(displayCookie)?.value;if(!token)redirect('/display/pair');
 const helper=String(form.get('helper')??''),absent=String(form.get('absent')??''),request=String(form.get('request')??'');
 if(![helper,absent,request].every(id=>/^[a-f0-9-]{36}$/i.test(id)))redirect('/display/contact-book?error=cover');
 const result=await displayClient().rpc('claim_pilot_display_duty',{device_token:token,target_absent:absent,target_helper:helper,request_key:request,expected_rule_version:Number(form.get('rule_version'))});
 revalidatePath('/display/contact-book');revalidatePath('/display/lunch');revalidatePath('/workspace/duty/covers');
 redirect(`/display/contact-book?student=${helper}&${result.error?'error=cover':'notice=cover'}`);
}
export type SubstituteSnapshot={rule_version:number;ready:boolean;opportunities:{student_id:string;name:string;jobs:string[];cover_id:string|null;status:string|null;helper_name:string|null;coins:number;basis_changed:boolean}[]};
export function SubstitutePanel({data,student,absent,preview=false}:{data:SubstituteSnapshot;student:string|null;absent:boolean;preview?:boolean}){
 if(!data.opportunities.length)return null;
 return <section style={{border:'2px solid #c9a44b',borderRadius:12,padding:12,background:'#29291e',fontSize:displayText(20)}}><h2 style={{margin:'0 0 8px',fontSize:displayText(24)}}>需要代班</h2>{!data.ready&&<p>請老師先確認代班獎勵設定。</p>}{data.opportunities.map(o=><article key={o.student_id} style={{borderTop:'1px solid #726944',padding:'10px 0'}}><strong>{o.jobs.join('、')}</strong><p style={{margin:'6px 0'}}>{o.name} 請假 · 老師確認完成後 +{o.coins} 金幣</p>{o.cover_id?<p style={{color:'#6ee7b7'}}>{o.helper_name??'同學'} {o.status==='approved'?'已完成':'已接下，待老師確認'}{o.basis_changed?'（出缺席已變更，請老師確認）':''}</p>:!student?<p>先選自己的座號，再自願接班。</p>:absent||student===o.student_id?<p>今天請假的同學不能接班。</p>:preview?<button disabled style={{minHeight:48,padding:10}}>我願意幫忙（僅預覽）</button>:data.ready&&<form action={volunteer}><input type="hidden" name="rule_version" value={data.rule_version}/><input type="hidden" name="helper" value={student}/><input type="hidden" name="absent" value={o.student_id}/><input type="hidden" name="request" value={randomUUID()}/><Submit pendingLabel="接班登記中…" fontSize={displayText(22)}>我願意幫忙</Submit></form>}</article>)}</section>;
}
