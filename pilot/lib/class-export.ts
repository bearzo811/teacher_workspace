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
