"use server";
import {cookies} from 'next/headers';
import {redirect} from 'next/navigation';
import {revalidatePath} from 'next/cache';
import {displayClient,displayCookie} from '../../../lib/display';
export async function submitHomework(form:FormData){
 if(process.env.PILOT_DISPLAY_HOMEWORK_SUBMIT_ENABLED!=='true')redirect('/display/contact-book');
 const token=(await cookies()).get(displayCookie)?.value;if(!token)redirect('/display/pair');
 const student=String(form.get('student')??''),assignment=String(form.get('assignment')??''),request=String(form.get('request')??'');
 if(![student,assignment,request].every(id=>/^[a-f0-9-]{36}$/i.test(id)))redirect('/display/contact-book?error=input');
 const result=await displayClient().rpc('submit_pilot_display_homework',{device_token:token,target_student:student,target_assignment:assignment,request_key:request});
 revalidatePath('/display/contact-book');redirect(`/display/contact-book?student=${student}&${result.error?'error=submit':`notice=submitted&assignment=${assignment}`}`);
}
