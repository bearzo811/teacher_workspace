import Link from 'next/link';
import {cookies} from 'next/headers';
import {redirect} from 'next/navigation';
import {displayClient,displayCookie} from '../../../lib/display';
import {LunchView,type Lunch} from './view';
export const dynamic='force-dynamic';
export default async function LunchPage({searchParams}:{searchParams:Promise<{notice?:string;student?:string;task?:string;error?:string}>}){
 if(process.env.PILOT_DISPLAY_LUNCH_ENABLED!=='true')redirect('/display');
 const token=(await cookies()).get(displayCookie)?.value;if(!token)redirect('/display/pair');
 const params=await searchParams,result=await displayClient().rpc('get_pilot_display_lunch',{device_token:token});
 if(result.error)return <main><p>午餐資料讀取失敗，請確認白板授權。</p><Link href="/display/pair">白板配對</Link></main>;
 const data=result.data as Lunch,success=params.notice==='routine'&&data.checks.some(c=>c.student_id===params.student&&c.task_key===params.task&&c.completed);
 return <LunchView data={data} canComplete={process.env.PILOT_DISPLAY_ROUTINES_ENABLED==='true'} message={params.error?'未能完成登記，請重試或請老師協助。':success?'已登記完成。':undefined}/>;
}
