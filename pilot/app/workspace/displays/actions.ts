"use server";
import {redirect} from "next/navigation";
import {revalidatePath} from "next/cache";
import {serverClient} from "../../../lib/supabase";
import {displaySections,validDisplayFont} from '../../../lib/display-settings';
export type PairingState={error?:string;code?:string;expires?:string};
async function teacher(){
 if(process.env.PILOT_DISPLAY_PAIRING_ENABLED!=="true")redirect('/workspace');
 const client=await serverClient(true),{data:{user},error}=await client.auth.getUser();
 if(error||!user||user.app_metadata.provider!=="google")redirect('/login');return client;
}
export async function createPairing(_state:PairingState,form:FormData):Promise<PairingState>{
 const client=await teacher(),name=String(form.get('name')??'').trim(),classId=String(form.get('classId')??'');
 if(!name||name.length>60||!/^[a-f0-9-]{36}$/i.test(classId))return {error:'請填寫有效的白板名稱。'};
 const result=await client.rpc('create_pilot_display_pairing',{target_class:classId,device_name:name});
 if(result.error||!/^[a-f0-9]{32}$/.test(result.data?.code??''))return {error:'未能建立配對碼，請確認未超過 5 台有效裝置或 200 筆歷史紀錄。'};
 revalidatePath('/workspace/displays');return {code:result.data.code,expires:result.data.expires_at};
}
export async function revokeDisplay(form:FormData){
 const client=await teacher(),classId=String(form.get('classId')??''),deviceId=String(form.get('deviceId')??'');
 if(form.get('confirm')!=='yes'||![classId,deviceId].every(id=>/^[a-f0-9-]{36}$/i.test(id)))redirect('/workspace/displays?error=input');
 const result=await client.rpc('revoke_pilot_display',{target_class:classId,target_device:deviceId});
 revalidatePath('/workspace/displays');redirect(`/workspace/displays?${result.error?'error=save':'notice=revoked'}`);
}
export async function saveAppearance(form:FormData){
 if(process.env.PILOT_DISPLAY_APPEARANCE_ENABLED!=='true')redirect('/workspace/displays');
 const client=await teacher(),classId=String(form.get('classId')??''),font=Number(form.get('font')),version=Number(form.get('version')),sections=form.getAll('section').map(String);
 if(!/^[a-f0-9-]{36}$/i.test(classId)||!validDisplayFont(font)||!Number.isInteger(version)||version<0||sections.some(id=>!displaySections.some(s=>s.id===id)))redirect('/workspace/displays?error=appearance');
 const result=await client.rpc('save_pilot_display_settings',{target_class:classId,font_size:font,sections,expected_version:version});
 revalidatePath('/workspace/displays');revalidatePath('/display','layout');
 redirect(`/workspace/displays?${result.error?'error=appearance':'notice=appearance'}`);
}
