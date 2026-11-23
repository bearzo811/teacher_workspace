"use server";
import {redirect} from 'next/navigation';
import {revalidatePath} from 'next/cache';
import {serverClient} from '../../../lib/supabase';
export async function saveDebtOrder(form:FormData){
 if(process.env.PILOT_DEBT_PREFERENCES_ENABLED!=='true')redirect('/workspace/debts');
 const client=await serverClient(true),{data:{user},error}=await client.auth.getUser();if(error||!user)redirect('/login');
 const id=(name:string)=>String(form.get(name)??'');
 if(!['class','student','term'].every(name=>/^[a-f0-9-]{36}$/i.test(id(name))))redirect('/workspace/debts?error=order');
 let keys:unknown;try{keys=JSON.parse(String(form.get('keys')??''));}catch{redirect('/workspace/debts?error=order');}
 const version=Number(form.get('version'));
 if(!Array.isArray(keys)||keys.length>2000||keys.some(key=>typeof key!=='string'||key.length>100)||!Number.isInteger(version)||version<0)redirect('/workspace/debts?error=order');
 const result=await client.rpc('save_pilot_debt_preference',{target_class:id('class'),target_student:id('student'),target_term:id('term'),priority_keys:keys,display_more:form.get('show_more')==='yes',expected_version:version});
 revalidatePath('/workspace/debts');revalidatePath('/display/debts');
 redirect(`/workspace/debts?${result.error?'error=order':'notice=ordered'}`);
}
