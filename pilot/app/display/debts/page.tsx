import Link from 'next/link';
import {cookies} from 'next/headers';
import {redirect} from 'next/navigation';
import {displayClient,displayCookie} from '../../../lib/display';
export const dynamic='force-dynamic';
import {DebtsView,type Data} from './view';
export default async function Debts(){
 if(process.env.PILOT_DISPLAY_OVERVIEWS_ENABLED!=='true')redirect('/display');
 const token=(await cookies()).get(displayCookie)?.value;if(!token)redirect('/display/pair');
 const result=await displayClient().rpc('get_pilot_display_debts',{device_token:token});
 if(result.error)return <main><h1>待完成資料暫時無法完整讀取</h1><p>請老師確認白板授權或作業範圍。</p><Link href="/display">白板首頁</Link></main>;
 const data=result.data as Data;
 return <DebtsView data={data}/>;
}
