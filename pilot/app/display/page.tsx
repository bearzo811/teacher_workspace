import {cookies} from 'next/headers';
import {redirect} from 'next/navigation';
import {displayClient,displayCookie} from '../../lib/display';
export const dynamic='force-dynamic';
export default async function Display(){
 if(process.env.PILOT_DISPLAY_PAIRING_ENABLED!=='true')redirect('/display/pair');
 const token=(await cookies()).get(displayCookie)?.value;if(!token)redirect('/display/pair');
 const result=await displayClient().rpc('get_pilot_display_context',{device_token:token});
 if(result.error||typeof result.data?.class_name!=='string')redirect('/display/pair');
 return <main style={{padding:32,lineHeight:1.8}}><h1>{result.data.class_name}</h1><p>白板已配對。此階段只驗證配對連線，學生資料與操作尚未開放。</p></main>;
}
