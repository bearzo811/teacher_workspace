"use server";
import {cookies} from 'next/headers';
import {redirect} from 'next/navigation';
import {revalidatePath} from 'next/cache';
import {displayClient,displayCookie} from '../../../lib/display';
import {shopInteger} from '../../../lib/shop';
export async function buyDisplayReward(form:FormData){
 if(process.env.PILOT_DISPLAY_SHOP_ENABLED!=='true')redirect('/display');
 const token=(await cookies()).get(displayCookie)?.value;if(!token)redirect('/display/pair');
 const student=String(form.get('student')??''),item=String(form.get('item')??''),request=String(form.get('request')??'');
 const offer=shopInteger(form.get('offer'),1,1000000),price=shopInteger(form.get('price'),0,10000);
 if(![student,item,request].every(id=>/^[a-f0-9-]{36}$/i.test(id))||offer===null||price===null)redirect('/display/shop?error=input');
 const result=await displayClient().rpc('buy_pilot_display_reward',{device_token:token,target_student:student,target_item:item,request_key:request,expected_offer:offer,expected_price:price});
 revalidatePath('/display/shop');redirect(`/display/shop?student=${student}&${result.error?'error=purchase':'notice=purchased'}`);
}
