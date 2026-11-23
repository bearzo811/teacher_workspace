"use server";
import {cookies} from 'next/headers';
import {redirect} from 'next/navigation';
import {revalidatePath} from 'next/cache';
import {displayClient,displayCookie} from '../../../lib/display';
export async function completeLearning(form:FormData){
 if(process.env.PILOT_DISPLAY_LEARNING_COMPLETE_ENABLED!=='true')redirect('/display/learning');
 const token=(await cookies()).get(displayCookie)?.value;if(!token)redirect('/display/pair');
 const student=String(form.get('student')??''),request=String(form.get('request')??''),source=String(form.get('source')??'');
 const plan=String(form.get('plan')??''),week=Number(form.get('week')),kind=String(form.get('kind')??''),month=String(form.get('month')??'');
 const uuid=(value:string)=>/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value);
 if(!uuid(student)||!uuid(request)||!['passport','reading'].includes(source)||source==='passport'&&(!uuid(plan)||!Number.isInteger(week)||week<1||week>25)||source==='reading'&&(!['newspaper','reflection'].includes(kind)||!/^\d{4}-\d{2}-01$/.test(month)))redirect('/display/learning?error=input');
 const result=await displayClient().rpc('complete_pilot_display_learning',{device_token:token,target_student:student,source_kind:source,target_plan:source==='passport'?plan:null,target_week:source==='passport'?week:null,reading_kind:source==='reading'?kind:null,target_month:source==='reading'?month:null,request_key:request});
 const target=source==='passport'?`${plan}:${week}`:`${kind}:${month}`;
 revalidatePath('/display/learning');revalidatePath('/display/debts');revalidatePath('/display/students');
 redirect(`/display/learning?student=${student}&mode=${source==='reading'?'reading':'passport'}&${result.error?'error=complete':`notice=completed&target=${encodeURIComponent(target)}`}`);
}
