import Link from 'next/link';
import {cookies} from 'next/headers';
import {redirect} from 'next/navigation';
import {displayClient,displayCookie} from '../../../lib/display';
export const dynamic='force-dynamic';
import {LearningView,type Snapshot} from './view';
export default async function Learning({searchParams}:{searchParams:Promise<{student?:string;mode?:string;error?:string;notice?:string;target?:string}>}){
 if(process.env.PILOT_DISPLAY_LEARNING_ENABLED!=='true')redirect('/display');
 const params=await searchParams,token=(await cookies()).get(displayCookie)?.value;if(!token)redirect('/display/pair');
 const student=params.student&&/^[a-f0-9-]{36}$/i.test(params.student)?params.student:null;
 const result=await displayClient().rpc('get_pilot_display_learning',{device_token:token,selected_student:student});
 if(result.error)return <main style={{padding:32}}><h1>護照與閱讀暫時無法開啟</h1><Link href="/display/learning">重新選擇</Link> · <Link href="/display/pair">白板配對</Link></main>;
 const data=result.data as Snapshot;
 const success=params.notice==='completed'&&!!student&&(data.passport_checks.some(c=>c.student_id===student&&c.completed&&`${c.passport_id}:${c.week}`===params.target)||data.reading_checks.some(c=>c.student_id===student&&c.status==='completed'&&`${c.kind}:${c.month}`===params.target));
 return <LearningView data={data} student={student} requestedMode={params.mode} canComplete={process.env.PILOT_DISPLAY_LEARNING_COMPLETE_ENABLED==='true'} message={params.error?'未能登記，請重新整理再試，或請老師協助。':success?'已完成登記。':undefined}/>;
}
