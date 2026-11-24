"use server";
import {cookies} from 'next/headers';
import {redirect} from 'next/navigation';
import {revalidatePath} from 'next/cache';
import {displayClient,displayCookie} from '../../../lib/display';
import {validRoutine} from '../../../lib/routines';
export async function submitHomework(form:FormData){
 if(process.env.PILOT_DISPLAY_HOMEWORK_SUBMIT_ENABLED!=='true')redirect('/display/contact-book');
 const token=(await cookies()).get(displayCookie)?.value;if(!token)redirect('/display/pair');
 const student=String(form.get('student')??''),assignment=String(form.get('assignment')??''),request=String(form.get('request')??'');
 if(![student,assignment,request].every(id=>/^[a-f0-9-]{36}$/i.test(id)))redirect('/display/contact-book?error=input');
 const result=await displayClient().rpc('submit_pilot_display_homework',{device_token:token,target_student:student,target_assignment:assignment,request_key:request});
 revalidatePath('/display/contact-book');redirect(`/display/contact-book?student=${student}&${result.error?'error=submit':`notice=submitted&assignment=${assignment}`}`);
}
export async function completeRoutine(form:FormData){
 if(process.env.PILOT_DISPLAY_ROUTINES_ENABLED!=='true')redirect('/display/contact-book');
 const surface=form.get('surface')==='lunch'?'/display/lunch':'/display/contact-book';
 if(surface==='/display/lunch'&&process.env.PILOT_DISPLAY_LUNCH_ENABLED!=='true')redirect('/display');
 const token=(await cookies()).get(displayCookie)?.value;if(!token)redirect('/display/pair');
 const student=String(form.get('student')??''),task=String(form.get('task')??''),request=String(form.get('request')??'');
 if(surface==='/display/lunch'&&!['lunch_brushing','noon_cleaning'].includes(task))redirect('/display/lunch?error=input');
 if(![student,request].every(id=>/^[a-f0-9-]{36}$/i.test(id))||(!validRoutine(task)&&task!=='summer_homework_submitted'))redirect(`${surface}?error=input`);
 const result=await displayClient().rpc('complete_pilot_display_routine',{device_token:token,target_student:student,routine_key:task,request_key:request});
 revalidatePath('/display/contact-book');revalidatePath('/display/lunch');redirect(`${surface}?student=${student}&${result.error?'error=routine':`notice=routine&task=${task}`}`);
}
