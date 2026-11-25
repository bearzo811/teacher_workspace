'use server';
import {redirect} from 'next/navigation';
import {revalidatePath} from 'next/cache';
import {serverClient} from '../../../../lib/supabase';
export async function reviewCover(form:FormData){
 if(process.env.PILOT_DUTY_SUBSTITUTES_ENABLED!=='true')redirect('/workspace/duty');
 const value=(key:string)=>String(form.get(key)??''),version=Number(value('version')),action=value('action');
 if(!['class','cover','request'].every(k=>/^[a-f0-9-]{36}$/i.test(value(k)))||!Number.isSafeInteger(version)||version<1||!['approve','cancel'].includes(action)||form.get('confirm')!=='yes')redirect('/workspace/duty/covers?error=input');
 const client=await serverClient(true),{data:{user},error}=await client.auth.getUser();if(error||!user)redirect('/login');
 const result=await client.rpc('review_pilot_duty_cover',{target_class:value('class'),target_cover:value('cover'),expected_version:version,review_action:action,request_key:value('request')});
 revalidatePath('/workspace/duty/covers');revalidatePath('/display/contact-book');revalidatePath('/display/lunch');revalidatePath('/workspace/duty');
 redirect(`/workspace/duty/covers?${result.error?'error=review':'notice=saved'}`);
}
