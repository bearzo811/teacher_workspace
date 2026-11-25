import {cookies} from 'next/headers';
import {NextRequest,NextResponse} from 'next/server';
import {displayClient,displayCookie} from '../../../../lib/display';
export const dynamic='force-dynamic';
async function device(){return (await cookies()).get(displayCookie)?.value;}
export async function GET(){
 if(process.env.PILOT_LUNCH_MEDIA_ENABLED!=='true')return NextResponse.json({error:'Unavailable'},{status:404});
 const token=await device();if(!token)return NextResponse.json({error:'Pairing required'},{status:401});
 const result=await displayClient().rpc('get_pilot_display_media',{device_token:token});
 return NextResponse.json(result.error?{error:'Media unavailable'}:result.data,{status:result.error?403:200,headers:{'Cache-Control':'private, no-store'}});
}
export async function POST(request:NextRequest){
 if(process.env.PILOT_LUNCH_MEDIA_ENABLED!=='true')return NextResponse.json({error:'Unavailable'},{status:404});
 if(request.headers.get('origin')!==new URL(request.url).origin)return NextResponse.json({error:'Origin denied'},{status:403});
 const token=await device();if(!token)return NextResponse.json({error:'Pairing required'},{status:401});
 const body=await request.text();if(body.length>128)return NextResponse.json({error:'Invalid request'},{status:400});
 let version:unknown;try{version=JSON.parse(body).version;}catch{return NextResponse.json({error:'Invalid request'},{status:400});}
 if(typeof version!=='number'||!Number.isSafeInteger(version)||version<1)return NextResponse.json({error:'Invalid request'},{status:400});
 const result=await displayClient().rpc('finish_pilot_display_media',{device_token:token,expected_version:version});
 return NextResponse.json(result.error?{error:'Unable to clear'}:{cleared:result.data},{status:result.error?403:200,headers:{'Cache-Control':'private, no-store'}});
}
