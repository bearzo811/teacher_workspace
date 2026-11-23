import Link from 'next/link';
import {cookies} from 'next/headers';
import {redirect} from 'next/navigation';
import {displayClient,displayCookie} from '../../../lib/display';
export const dynamic='force-dynamic';
import {PointsView,type Points} from './view';
export default async function Students(){
 if(process.env.PILOT_DISPLAY_OVERVIEWS_ENABLED!=='true')redirect('/display');
 const token=(await cookies()).get(displayCookie)?.value;if(!token)redirect('/display/pair');
 const result=await displayClient().rpc('get_pilot_display_points',{device_token:token});
 if(result.error)return <main><p>學生資訊讀取失敗，請確認白板授權。</p><Link href="/display/pair">白板配對</Link></main>;
 const data=result.data as Points;
 return <PointsView data={data}/>;
}
