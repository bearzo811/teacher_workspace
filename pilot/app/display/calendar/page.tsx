import Link from 'next/link';
import {cookies} from 'next/headers';
import {redirect} from 'next/navigation';
import {displayClient,displayCookie} from '../../../lib/display';
export const dynamic='force-dynamic';

import {CalendarView,type Calendar} from './view';
export default async function CalendarPage({searchParams}:{searchParams:Promise<{offset?:string}>}){
 if(process.env.PILOT_DISPLAY_OVERVIEWS_ENABLED!=='true')redirect('/display');
 const params=await searchParams,text=params.offset??'0',offset=/^-?\d{1,2}$/.test(text)?Number(text):99;
 if(offset<-12||offset>12)return <main><p>月份超出範圍。</p><Link href="/display/calendar">回本月</Link></main>;
 const token=(await cookies()).get(displayCookie)?.value;if(!token)redirect('/display/pair');
 const result=await displayClient().rpc('get_pilot_display_calendar',{device_token:token,month_offset:offset});
 if(result.error)return <main><p>行事曆讀取失敗，請確認白板授權。</p><Link href="/display/pair">白板配對</Link></main>;
 return <CalendarView data={result.data as Calendar} offset={offset}/>;
}
