import Link from 'next/link';
import {cookies} from 'next/headers';
import {redirect} from 'next/navigation';
import {displayClient,displayCookie} from '../../../lib/display';
import {schoolDay,type Term,type DayOverride} from '../../../lib/calendar';
import {daysUntil} from '../../../lib/events';
export const dynamic='force-dynamic';
type Event={id:string;title:string;day:string;note:string};
type Calendar={today:string;month:string;term:Term|null;days:DayOverride[];events:Event[];countdowns:Event[]};
export default async function CalendarPage({searchParams}:{searchParams:Promise<{offset?:string}>}){
 if(process.env.PILOT_DISPLAY_OVERVIEWS_ENABLED!=='true')redirect('/display');
 const params=await searchParams,text=params.offset??'0',offset=/^-?\d{1,2}$/.test(text)?Number(text):99;
 if(offset<-12||offset>12)return <main><p>月份超出範圍。</p><Link href="/display/calendar">回本月</Link></main>;
 const token=(await cookies()).get(displayCookie)?.value;if(!token)redirect('/display/pair');
 const result=await displayClient().rpc('get_pilot_display_calendar',{device_token:token,month_offset:offset});
 if(result.error)return <main><p>行事曆讀取失敗，請確認白板授權。</p><Link href="/display/pair">白板配對</Link></main>;
 const data=result.data as Calendar,start=new Date(data.month+'T00:00:00Z'),firstWeekday=start.getUTCDay(),last=new Date(start.getTime());last.setUTCMonth(last.getUTCMonth()+1);last.setUTCDate(0);const count=last.getUTCDate(),rows=Math.ceil((firstWeekday+count)/7);
 return <main style={{height:'100%',boxSizing:'border-box',padding:20,display:'flex',flexDirection:'column',gap:16,background:'#071020',color:'#eef5ff',fontSize:22,overflow:'hidden'}}><header style={{flexShrink:0,display:'flex',gap:20,alignItems:'center'}}><Link href="/display" style={{color:'#a5d8ff'}}>白板首頁</Link><h1 style={{margin:0}}>{data.month.slice(0,7)}</h1>{offset>-12&&<Link style={{color:'#a5d8ff'}} href={`/display/calendar?offset=${offset-1}`}>上月</Link>}<Link style={{color:'#a5d8ff'}} href="/display/calendar">本月</Link>{offset<12&&<Link style={{color:'#a5d8ff'}} href={`/display/calendar?offset=${offset+1}`}>下月</Link>}</header>
 <section style={{flex:1,minHeight:0,display:'grid',gridTemplateColumns:'minmax(0,3fr) minmax(0,1fr)',gap:20}}><section style={{minHeight:0,display:'flex',flexDirection:'column'}}><div style={{display:'grid',gridTemplateColumns:'repeat(7,minmax(0,1fr))',flexShrink:0}}>{['日','一','二','三','四','五','六'].map(day=><strong key={day} style={{padding:10,textAlign:'center'}}>{day}</strong>)}</div><div style={{flex:1,minHeight:0,display:'grid',gridTemplateColumns:'repeat(7,minmax(0,1fr))',gridTemplateRows:`repeat(${rows},minmax(0,1fr))`,gap:5}}>{Array.from({length:rows*7},(_,i)=>{const day=i-firstWeekday+1;if(day<1||day>count)return <div key={i}/>;const date=`${data.month.slice(0,7)}-${String(day).padStart(2,'0')}`,holiday=data.term?!schoolDay(date,data.term,data.days):i%7===0||i%7===6;return <article key={i} style={{padding:8,border:`1px solid ${date===data.today?'#fbbf24':'#475569'}`,borderRadius:8,minHeight:0,overflowY:'auto',background:'#111e33'}}><strong style={{color:holiday?'#fda4af':'#eef5ff'}}>{day}</strong>{data.days.find(d=>d.day===date)?.note&&<p style={{fontSize:16,margin:'4px 0'}}>{data.days.find(d=>d.day===date)!.note}</p>}{data.events.filter(e=>e.day===date).map(e=><p key={e.id} style={{fontSize:18,margin:'4px 0',overflowWrap:'anywhere'}}>{e.title}</p>)}</article>;})}</div></section>
 <aside aria-label="活動倒數" style={{minHeight:0,overflowY:'auto',overscrollBehavior:'contain',border:'1px solid #475569',borderRadius:12,padding:16}}><h2 style={{marginTop:0}}>活動倒數</h2>{!data.countdowns.length&&<p>目前沒有倒數活動。</p>}{data.countdowns.map(e=><article key={e.id} style={{borderBottom:'1px solid #475569',padding:'10px 0',overflowWrap:'anywhere'}}><strong style={{fontSize:26}}>{e.title}</strong><p style={{color:'#fde68a'}}>{daysUntil(data.today,e.day)===0?'就是今天':`還有 ${daysUntil(data.today,e.day)} 天`}</p><p>{e.day}</p>{e.note&&<p style={{whiteSpace:'pre-wrap'}}>{e.note}</p>}</article>)}</aside></section></main>;
}
