'use server';
import {redirect} from 'next/navigation';
import {revalidatePath} from 'next/cache';
import {serverClient} from '../../../lib/supabase';
import {youtubeVideoId} from '../../../lib/lunch-media';
export async function saveLunchMedia(form:FormData){
 if(process.env.PILOT_LUNCH_MEDIA_ENABLED!=='true')redirect('/workspace');
 const value=(key:string)=>String(form.get(key)??''),clear=value('action')==='stop',video=clear?null:youtubeVideoId(value('url')),title=clear?'':value('title').trim(),version=Number(value('version'));
 if(!['class','request'].every(k=>/^[a-f0-9-]{36}$/i.test(value(k)))||!Number.isSafeInteger(version)||version<0||title.length>120||(!clear&&!video))redirect('/workspace/lunch-media?error=input');
 const client=await serverClient(true),{data:{user},error}=await client.auth.getUser();if(error||!user)redirect('/login');
 const result=await client.rpc('set_pilot_lunch_media',{target_class:value('class'),target_video:video,target_title:title,expected_version:version,request_key:value('request')});
 revalidatePath('/workspace/lunch-media');revalidatePath('/display/lunch');redirect(`/workspace/lunch-media?${result.error?'error=save':'notice=saved'}`);
}
