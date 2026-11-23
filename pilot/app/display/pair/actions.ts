"use server";
import {cookies} from 'next/headers';
import {redirect} from 'next/navigation';
import {displayClient,displayCookie} from '../../../lib/display';
export async function pairDisplay(_state:{error?:string},form:FormData):Promise<{error?:string}>{
 if(process.env.PILOT_DISPLAY_PAIRING_ENABLED!=='true')return {error:'白板配對尚未開放。'};
 const code=String(form.get('code')??'').trim().toLowerCase();
 if(!/^[a-f0-9]{32}$/.test(code))return {error:'請貼上完整的配對碼。'};
 const result=await displayClient().rpc('pair_pilot_display',{pairing_code:code});
 if(result.error||!/^[a-f0-9]{64}$/.test(result.data?.token??''))return {error:'配對碼無效、已使用或已到期，請老師重新建立。'};
 (await cookies()).set(displayCookie,result.data.token,{httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'strict',path:'/display',maxAge:90*24*60*60});
 redirect('/display');
}
