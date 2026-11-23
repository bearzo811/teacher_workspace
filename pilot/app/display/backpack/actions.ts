"use server";
import {cookies} from 'next/headers';
import {redirect} from 'next/navigation';
import {revalidatePath} from 'next/cache';
import {displayClient,displayCookie} from '../../../lib/display';
import {shopInteger} from '../../../lib/shop';
export async function requestRewardUse(form:FormData){
 if(process.env.PILOT_DISPLAY_BACKPACK_ENABLED!=='true')redirect('/display');
 const token=(await cookies()).get(displayCookie)?.value;if(!token)redirect('/display/pair');
 const student=String(form.get('student')??''),reward=String(form.get('reward')??''),request=String(form.get('request')??''),version=shopInteger(form.get('version'),1,1000000),page=shopInteger(form.get('page'),1,20);
 if(![student,reward,request].every(id=>/^[a-f0-9-]{36}$/i.test(id))||version===null||page===null)redirect('/display/backpack?error=input');
 const result=await displayClient().rpc('request_pilot_display_reward',{device_token:token,target_student:student,target_reward:reward,request_key:request,expected_version:version});
 revalidatePath('/display/backpack');redirect(`/display/backpack?student=${student}&page=${page}&${result.error?'error=request':`notice=requested&reward=${reward}`}`);
}
