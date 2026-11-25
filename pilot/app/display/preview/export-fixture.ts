import {createHash} from 'node:crypto';
import {exportFormat,type ClassExport} from '../../../lib/class-export';
// Deterministic synthetic data for the development-only visual route. No database access.
export function exportFixture(count:number){
 const classId='a0420000-0000-4000-8000-000000000001',id='a0420000-0000-4000-8000-000000000002';
 const students=Array.from({length:count},(_,i)=>({id:`b0420000-0000-4000-8000-${String(i+1).padStart(12,'0')}`,class_id:classId,seat:i+1,name:`虛構學生${i+1}`}));
 const tables={pilot_students:students,pilot_reward_ledger:[],pilot_reward_balances:students.map(s=>({class_id:classId,student_id:s.id,coin_net:0,xp_total:0}))};
 const payload=JSON.stringify({format:exportFormat,schema_revision:41,export_id:id,generated_at:'2026-11-25T00:00:00Z',class:{id:classId,name:'虛構檔案驗收班'},tables});
 const envelope:ClassExport={id,payload,bytes:Buffer.byteLength(payload),sha256:createHash('sha256').update(payload).digest('hex'),counts:Object.fromEntries(Object.entries(tables).map(([key,rows])=>[key,rows.length]))};
 return {classId,envelope};
}
