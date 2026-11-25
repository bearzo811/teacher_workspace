import {createHash} from 'node:crypto';
import {NextRequest,NextResponse} from 'next/server';
import {serverClient} from '../../../../lib/supabase';
import {validClassExport} from '../../../../lib/class-export';
import {taipeiToday} from '../../../../lib/calendar';
export const dynamic='force-dynamic';
export async function POST(request:NextRequest){
 if(process.env.PILOT_CLASS_EXPORTS_ENABLED!=='true')return NextResponse.json({error:'此功能尚未開放。'},{status:404});
 if(request.headers.get('origin')!==new URL(request.url).origin)return NextResponse.json({error:'請從工作台重新操作。'},{status:403});
 const raw=await request.text();if(raw.length>128)return NextResponse.json({error:'輸入無效。'},{status:400});
 let classId:unknown;try{classId=JSON.parse(raw).classId;}catch{return NextResponse.json({error:'輸入無效。'},{status:400});}
 if(typeof classId!=='string'||!/^[a-f0-9-]{36}$/i.test(classId))return NextResponse.json({error:'輸入無效。'},{status:400});
 const client=await serverClient(true),{data:{user},error}=await client.auth.getUser();if(error||!user)return NextResponse.json({error:'請重新登入。'},{status:401});
 const result=await client.rpc('export_pilot_class',{target_class:classId});
 if(result.error)return NextResponse.json({error:result.error.message.includes('Wait 30 seconds')?'剛產生過匯出，請等 30 秒後重試。':result.error.message.includes('exceeds 3 MB')||result.error.message.includes('row limit')?'資料超過目前匯出容量，未產生截斷檔案，請聯絡支援。':'暫時無法匯出，請重新登入或稍後重試。'},{status:result.error.code==='42501'?403:409});
 if(!validClassExport(result.data,classId)||createHash('sha256').update(result.data.payload,'utf8').digest('hex')!==result.data.sha256)return NextResponse.json({error:'匯出檔完整性驗證失敗，未開始下載。'},{status:500});
 return new NextResponse(result.data.payload,{headers:{'Content-Type':'application/json; charset=utf-8','Content-Disposition':`attachment; filename="classroom-${taipeiToday()}-${result.data.id}.json"`,'Cache-Control':'private, no-store','X-Export-SHA256':result.data.sha256,'X-Content-Type-Options':'nosniff'}});
}
