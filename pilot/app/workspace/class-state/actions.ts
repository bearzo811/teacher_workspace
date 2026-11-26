"use server";
import {redirect} from 'next/navigation';
import {revalidatePath} from 'next/cache';
import {serverClient} from '../../../lib/supabase';
export async function changeClassState(form:FormData){
 if(process.env.PILOT_CLASS_PAUSE_ENABLED!=='true')redirect('/workspace');
 const client=await serverClient(true),{data:{user},error}=await client.auth.getUser();if(error||!user||user.app_metadata.provider!=='google')redirect('/login');
 const value=(key:string)=>String(form.get(key)??''),uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
 const mode=value('mode'),stamp=value('pausedAt'),note=value('note').trim();
 if(!uuid.test(value('class'))||!uuid.test(value('request'))||!['pause','resume'].includes(mode)||!note||note.length>200||form.get('confirm')!=='yes'||(mode==='pause'&&stamp)||(mode==='resume'&&(!stamp||stamp.length>50||!Number.isFinite(Date.parse(stamp)))))redirect('/workspace/class-state?error=input');
 const result=await client.rpc('change_pilot_class_state',{target_class:value('class'),class_action:mode,expected_paused_at:stamp||null,request_key:value('request'),action_note:note});
 revalidatePath('/workspace','layout');revalidatePath('/display','layout');
 redirect(`/workspace/class-state?${result.error?`error=${result.error.code==='40001'?'changed':'save'}`:`notice=${mode}`}`);
}
