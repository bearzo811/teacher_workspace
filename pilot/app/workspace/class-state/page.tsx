import {ClassStateView,type Paused} from './view';
import {redirect} from 'next/navigation';
import {serverClient} from '../../../lib/supabase';
export const dynamic='force-dynamic';
export default async function ClassState({searchParams}:{searchParams:Promise<{error?:string;notice?:string}>}){
 if(process.env.PILOT_CLASS_PAUSE_ENABLED!=='true')redirect('/workspace');
 const params=await searchParams,client=await serverClient(),{data:{user},error}=await client.auth.getUser();if(error||!user)redirect('/login');
 const [active,paused]=await Promise.all([client.from('pilot_classes').select('id,name').is('deleted_at',null),client.rpc('list_pilot_paused_classes')]);
 const room=active.data?.[0],records=(paused.data??[]) as Paused[],unavailable=active.error||paused.error;
 return <ClassStateView room={room} records={records} unavailable={Boolean(unavailable)} params={params}/>;
}
