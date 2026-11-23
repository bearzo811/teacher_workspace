import Link from 'next/link';
import {cookies} from 'next/headers';
import {redirect} from 'next/navigation';
import {randomUUID} from 'node:crypto';
import {displayClient,displayCookie} from '../../../lib/display';
import {Submit} from '../../workspace/submit';
import {buyDisplayReward} from './actions';
export const dynamic='force-dynamic';
type Shop={class_name:string;enabled:boolean;students:{id:string;seat:number;name:string}[];products:{id:string;name:string;icon:string;description:string;price:number;min_level:number;stock:number;offer_version:number}[];eligibility:null|{shop_open:boolean;learning_clear:boolean;rules_confirmed:boolean;coins:number;level:number|null;homework:number;passports:number;reading:number}};
export default async function ShopPage({searchParams}:{searchParams:Promise<{student?:string;error?:string;notice?:string}>}){
 if(process.env.PILOT_DISPLAY_SHOP_ENABLED!=='true')redirect('/display');
 const params=await searchParams,token=(await cookies()).get(displayCookie)?.value;if(!token)redirect('/display/pair');
 const student=params.student&&/^[a-f0-9-]{36}$/i.test(params.student)?params.student:null;
 const result=await displayClient().rpc('get_pilot_display_shop',{device_token:token,selected_student:student});
 if(result.error)return <main style={{padding:32}}><h1>商店暫時無法開啟</h1><p>請重新選擇學生；若裝置已被撤銷或到期，請老師重新配對。</p><Link href="/display/shop">重新選擇</Link> · <Link href="/display/pair">白板配對</Link></main>;
 const data=result.data as Shop,selected=data.students.find(s=>s.id===student),state=data.eligibility;
 return <main style={{height:'100dvh',display:'flex',flexDirection:'column',background:'#071020',color:'#eef5ff',padding:20,boxSizing:'border-box',fontSize:20,gap:12}}>
 <header style={{flexShrink:0}}><Link href="/display" style={{color:'#a5d8ff'}}>← 白板</Link><h1 style={{margin:'8px 0'}}>班級商店</h1>{params.notice==='purchased'&&<p role="status" style={{color:'#6ee7b7'}}>購買成功，獎品已放入背包。</p>}{params.error&&<p role="alert" style={{color:'#fda4af'}}>未完成購買。請確認金幣、等級、待完成項目或商品價格／庫存，再試一次。</p>}
 {!data.enabled?<p>本班尚未開啟商店模組。</p>:<><form method="get"><label>我是 <select name="student" defaultValue={student??''} required style={{fontSize:'inherit'}}><option value="" disabled>選自己的座號</option>{data.students.map(s=><option key={s.id} value={s.id}>{s.seat} 號 {s.name}</option>)}</select></label> <button style={{fontSize:'inherit'}}>選擇</button></form>
 {selected&&state&&<><p>{selected.name} · Lv.{state.level??'—'} · {state.coins} 金幣</p><p>{!state.shop_open?'商店尚未開放':!state.learning_clear?`尚待完成：作業 ${state.homework}、護照 ${state.passports}、閱讀／讀報 ${state.reading}`:'點擊購買會立即扣金幣，獎品永久保存在背包。'}</p></>}</>}
 {selected&&process.env.PILOT_DISPLAY_BACKPACK_ENABLED==='true'&&<p><Link href={`/display/backpack?student=${student}`} style={{color:'#a5d8ff'}}>查看我的背包</Link></p>}
 </header>
 <section aria-label="商品清單" style={{minHeight:0,overflowY:'auto',flex:1,display:'grid',gridTemplateColumns:'repeat(4,minmax(0,1fr))',alignContent:'start',gap:16}}>{data.products.map(item=>{const disabled=!selected||!state||!state.shop_open||!state.learning_clear||!state.rules_confirmed||state.level===null||state.level<item.min_level||state.coins<item.price||item.stock===0;return <article key={item.id} style={{border:'1px solid #475569',borderRadius:12,padding:16,minWidth:0,overflowWrap:'anywhere',background:'#111e33'}}><h2 style={{fontSize:26}}>{item.icon} {item.name}</h2><p>Lv.{item.min_level} · {item.price} 金幣</p><p>{item.stock===-1?'無限供應':item.stock===0?'售罄':`剩餘 ${item.stock} 份`}</p><p style={{whiteSpace:'pre-wrap'}}>{item.description}</p>{disabled?<button disabled style={{fontSize:20}}>{!selected?'先選座號':item.stock===0?'售罄':'目前無法購買'}</button>:<form action={buyDisplayReward}><input type="hidden" name="student" value={student!}/><input type="hidden" name="item" value={item.id}/><input type="hidden" name="request" value={randomUUID()}/><input type="hidden" name="offer" value={item.offer_version}/><input type="hidden" name="price" value={item.price}/><Submit pendingLabel="購買中…" fontSize={22}>{`購買 · ${item.price} 金幣`}</Submit></form>}</article>;})}</section>
 </main>;
}
