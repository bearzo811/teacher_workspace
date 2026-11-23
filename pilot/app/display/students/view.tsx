import Link from 'next/link';
import {rewardLevel} from '../../../lib/rewards';
export type Points={enabled:boolean;rules_confirmed:boolean;level_base_xp:number;shop_open:boolean;students:{id:string;seat:number;name:string;coin_net:number;xp_total:number}[]};
export function PointsView({data}:{data:Points}){
 const card={minHeight:0,minWidth:0,border:'1px solid #475569',borderRadius:12,padding:'clamp(8px,.8vw,20px)',background:'#111e33'};
 return <main style={{height:'100%',boxSizing:'border-box',padding:'clamp(12px,1vw,24px)',display:'flex',flexDirection:'column',gap:12,background:'#071020',color:'#eef5ff',fontSize:'clamp(14px,1vw,32px)'}}>
 <header style={{flexShrink:0,display:'flex',alignItems:'center',gap:24}}><Link href="/display" style={{color:'#a5d8ff'}}>白板首頁</Link><h1 style={{fontSize:'clamp(24px,1.8vw,44px)',margin:'4px 0'}}>學生資訊</h1></header>
 {!data.enabled?<p>本班尚未使用金幣與背包功能。</p>:<section aria-label="學生點數卡片" style={{flex:1,minHeight:0,display:'grid',gridTemplateColumns:`repeat(${Math.min(5,data.students.length+1)},minmax(0,1fr))`,gridAutoRows:'minmax(0,1fr)',gap:'clamp(8px,.8vw,20px)'}}>
 {data.students.map(s=>{const progress=rewardLevel(s.xp_total,data.level_base_xp);return <Link key={s.id} href={process.env.PILOT_DISPLAY_BACKPACK_ENABLED==='true'?`/display/backpack?student=${s.id}`:'/display'} style={{...card,color:'inherit',textDecoration:'none',display:'flex',flexDirection:'column',justifyContent:'space-between',gap:4}}>
 <div style={{display:'flex',justifyContent:'space-between',alignItems:'start',gap:8}}><strong style={{fontSize:'clamp(16px,1.2vw,44px)',overflowWrap:'anywhere'}}>{s.seat} {s.name}</strong><span style={{fontSize:'clamp(13px,.8vw,30px)',whiteSpace:'nowrap',color:'#c4b5fd'}}>Lv.{progress?.level??1}</span></div>
 <div><p style={{margin:'4px 0'}}>XP {progress?.currentXp??0}／{progress?.requiredXp??data.level_base_xp}</p><progress value={progress?.percent??0} max={100} style={{width:'100%',height:8,display:'block'}}/><p style={{color:'#fde68a',fontSize:'clamp(18px,1.3vw,48px)',fontWeight:700,margin:'4px 0 0'}}>{Math.max(0,s.coin_net)} 金幣</p></div>
 </Link>;})}
 {data.shop_open?<Link href="/display/shop" style={{...card,color:'#fde68a',textDecoration:'none',display:'grid',placeItems:'center',fontSize:'clamp(18px,1.3vw,48px)'}}>班級商店 開放中</Link>:<div aria-disabled="true" style={{...card,color:'#94a3b8',display:'grid',placeItems:'center',fontSize:'clamp(18px,1.3vw,48px)'}}>班級商店 尚未開放</div>}
 </section>}</main>;
}
