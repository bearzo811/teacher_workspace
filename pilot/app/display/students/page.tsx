import Link from 'next/link';
import {cookies} from 'next/headers';
import {redirect} from 'next/navigation';
import {displayClient,displayCookie} from '../../../lib/display';
import {rewardLevel} from '../../../lib/rewards';
export const dynamic='force-dynamic';
type Points={enabled:boolean;rules_confirmed:boolean;level_base_xp:number;shop_open:boolean;students:{id:string;seat:number;name:string;coin_net:number;xp_total:number}[]};
export default async function Students(){
 if(process.env.PILOT_DISPLAY_OVERVIEWS_ENABLED!=='true')redirect('/display');
 const token=(await cookies()).get(displayCookie)?.value;if(!token)redirect('/display/pair');
 const result=await displayClient().rpc('get_pilot_display_points',{device_token:token});
 if(result.error)return <main><p>學生資訊讀取失敗，請確認白板授權。</p><Link href="/display/pair">白板配對</Link></main>;
 const data=result.data as Points;
 return <main style={{height:'100%',boxSizing:'border-box',padding:20,display:'flex',flexDirection:'column',gap:16,background:'#071020',color:'#eef5ff',fontSize:22}}><header style={{flexShrink:0}}><Link href="/display" style={{color:'#a5d8ff'}}>白板首頁</Link><h1>學生資訊</h1></header>{!data.enabled?<p>本班尚未使用金幣與背包功能。</p>:<section style={{flex:1,minHeight:0,display:'grid',gridTemplateColumns:`repeat(${Math.min(5,data.students.length+1)},minmax(0,1fr))`,gridAutoRows:'minmax(0,1fr)',gap:16}}>{data.students.map(s=>{const progress=rewardLevel(s.xp_total,data.level_base_xp);return <Link key={s.id} href={process.env.PILOT_DISPLAY_BACKPACK_ENABLED==='true'?`/display/backpack?student=${s.id}`:'/display'} style={{minHeight:0,border:'1px solid #475569',borderRadius:12,padding:16,color:'inherit',textDecoration:'none',display:'flex',flexDirection:'column',gap:12,overflow:'auto',background:'#111e33'}}><strong style={{fontSize:28}}>{s.seat} {s.name}</strong><span>Lv.{progress?.level??1}</span><div style={{marginTop:'auto'}}><p>XP {progress?.currentXp??0}／{progress?.requiredXp??data.level_base_xp}</p><progress value={progress?.percent??0} max={100} style={{width:'100%'}}/><p style={{color:'#fde68a',fontSize:28}}>{Math.max(0,s.coin_net)} 金幣</p></div></Link>;})}{data.shop_open?<Link href="/display/shop" style={{border:'1px solid #475569',borderRadius:12,padding:20,color:'#fde68a',textDecoration:'none',display:'grid',placeItems:'center',background:'#111e33'}}>班級商店 開放中</Link>:<div aria-disabled="true" style={{border:'1px solid #475569',borderRadius:12,padding:20,color:'#94a3b8',display:'grid',placeItems:'center',background:'#111e33'}}>班級商店 尚未開放</div>}</section>}</main>;
}
