import {cookies} from 'next/headers';
import {redirect} from 'next/navigation';
import Link from 'next/link';
import {displayClient,displayCookie} from '../../lib/display';
export const dynamic='force-dynamic';
export default async function Display(){
 if(process.env.PILOT_DISPLAY_PAIRING_ENABLED!=='true')redirect('/display/pair');
 const token=(await cookies()).get(displayCookie)?.value;if(!token)redirect('/display/pair');
 const result=await displayClient().rpc('get_pilot_display_context',{device_token:token});
 if(result.error||typeof result.data?.class_name!=='string')redirect('/display/pair');
 return <main style={{padding:32,lineHeight:1.8}}><h1>{result.data.class_name}</h1><p>白板已配對。</p>{process.env.PILOT_DISPLAY_CONTACT_ENABLED==='true'&&<p><Link href="/display/contact-book">聯絡簿與今日進度</Link></p>}{process.env.PILOT_DISPLAY_LEARNING_ENABLED==='true'&&<p><Link href="/display/learning">護照與閱讀</Link></p>}{process.env.PILOT_DISPLAY_LUNCH_ENABLED==='true'&&<p><Link href="/display/lunch">午餐工作與生活任務</Link></p>}{process.env.PILOT_DISPLAY_OVERVIEWS_ENABLED==='true'&&<><p><Link href="/display/students">學生資訊</Link></p><p><Link href="/display/debts">待完成作業</Link></p><p><Link href="/display/calendar">行事曆</Link></p></>}{process.env.PILOT_DISPLAY_SHOP_ENABLED==='true'?<p><Link href="/display/shop">班級商店</Link></p>:<p>學生資料與操作尚未開放。</p>}{process.env.PILOT_DISPLAY_BACKPACK_ENABLED==='true'&&<p><Link href="/display/backpack">我的背包</Link></p>}</main>;
}
