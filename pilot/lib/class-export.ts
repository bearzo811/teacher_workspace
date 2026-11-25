export const exportFormat='teacher-pilot-class-export/1';
export const maxExportBytes=3145728;
export type ClassExport={id:string;payload:string;sha256:string;bytes:number;counts:Record<string,number>};
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
/** Validate the envelope without reserializing its byte-exact downloadable payload. */
export function validClassExport(value:unknown,classId:string):value is ClassExport{
 if(!value||typeof value!=='object'||Array.isArray(value)||!uuid.test(classId))return false;
 const e=value as ClassExport;
 if(typeof e.id!=='string'||!uuid.test(e.id)||typeof e.payload!=='string'||typeof e.sha256!=='string'||!/^[a-f0-9]{64}$/.test(e.sha256)||!Number.isInteger(e.bytes)||e.bytes<1||e.bytes>maxExportBytes||new TextEncoder().encode(e.payload).length!==e.bytes||!e.counts||typeof e.counts!=='object'||Array.isArray(e.counts))return false;
 try{
  const snapshot=JSON.parse(e.payload);
  if(snapshot.format!==exportFormat||snapshot.schema_revision!==41||snapshot.export_id!==e.id||snapshot.class?.id!==classId||'owner_id' in snapshot.class||!snapshot.tables||typeof snapshot.tables!=='object'||Array.isArray(snapshot.tables))return false;
  const keys=Object.keys(snapshot.tables);
  if(keys.length<1||keys.length>64||keys.length!==Object.keys(e.counts).length||keys.some(k=>!/^pilot_[a-z_]+$/.test(k)||['pilot_teachers','pilot_classes','pilot_display_devices','pilot_class_exports'].includes(k)))return false;
  let total=0;
  for(const key of keys){if(!Array.isArray(snapshot.tables[key])||!Number.isSafeInteger(e.counts[key])||e.counts[key]!==snapshot.tables[key].length)return false;total+=e.counts[key];}
  return total<=50000;
 }catch{return false;}
}
/** Limited offline inspection. This is not a database restore or full foreign-key validation. */
export function inspectClassExport(value:ClassExport,classId:string){
 const problems=new Set<string>();
 if(!validClassExport(value,classId))return {problems:['檔案格式、班級或筆數不符。'],students:0,rows:0};
 const data=JSON.parse(value.payload).tables as Record<string,Record<string,unknown>[]>;
 const students=new Set<string>();
 for(const row of data.pilot_students??[]){
  if(!row||typeof row.id!=='string'||!uuid.test(row.id)||students.has(row.id))problems.add('學生識別資料重複或無效。');
  else students.add(row.id);
 }
 const totals=new Map<string,{coins:number;xp:number}>(),balances=new Set<string>();
 for(const rows of Object.values(data))for(const row of rows){
  if(!row||typeof row!=='object'||Array.isArray(row)){problems.add('資料列格式無效。');continue;}
  if('class_id' in row&&row.class_id!==classId)problems.add('檔案包含其他班級的資料。');
  for(const key of ['student_id','helper_student_id','absent_student_id'])if(key in row&&!students.has(String(row[key])))problems.add('有學生紀錄缺少對應名冊。');
 }
 for(const row of data.pilot_reward_ledger??[]){
  if(!row||typeof row.student_id!=='string'||!Number.isSafeInteger(row.coin_delta)||!Number.isSafeInteger(row.xp_delta)||Math.abs(Number(row.coin_delta))>10000||Math.abs(Number(row.xp_delta))>10000){problems.add('金幣／XP 帳本資料無效。');continue;}
  const total=totals.get(row.student_id)??{coins:0,xp:0};total.coins+=Number(row.coin_delta);total.xp+=Number(row.xp_delta);totals.set(row.student_id,total);
 }
 for(const row of data.pilot_reward_balances??[]){
  if(!row||typeof row.student_id!=='string'||balances.has(row.student_id)){problems.add('餘額資料重複或無效。');continue;}
  balances.add(row.student_id);const total=totals.get(row.student_id)??{coins:0,xp:0};
  if(!Number.isSafeInteger(row.coin_net)||!Number.isSafeInteger(row.xp_total)||Math.abs(Number(row.coin_net))>1000000000||Number(row.xp_total)<0||Number(row.xp_total)>1000000000||row.coin_net!==total.coins||row.xp_total!==total.xp)problems.add('金幣／XP 帳本合計與餘額不一致。');
 }
 if([...totals.keys()].some(id=>!balances.has(id)))problems.add('帳本缺少對應餘額紀錄。');
 return {problems:[...problems],students:students.size,rows:Object.values(value.counts).reduce((n,v)=>n+v,0)};
}
