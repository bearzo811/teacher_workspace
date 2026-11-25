import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {validClassExport,exportFormat,maxExportBytes} from '../lib/class-export';
const classId='a0420000-0000-4000-8000-000000000001',exportId='a0420000-0000-4000-8000-000000000002';
function envelope(change:Record<string,unknown>={}){
 const payload=JSON.stringify({format:exportFormat,schema_revision:41,export_id:exportId,class:{id:classId,name:'虛構班級'},tables:{pilot_students:[{name:'虛構同學🙂'}]},...change});
 return {id:exportId,payload,sha256:createHash('sha256').update(payload).digest('hex'),bytes:Buffer.byteLength(payload),counts:{pilot_students:1}};
}
test('class export preserves byte-exact Unicode payload and binds its class, export ID and table counts',()=>{
 const data=envelope(),before=data.payload;
 assert.equal(validClassExport(data,classId),true);assert.equal(data.payload,before);
 assert.equal(validClassExport(data,'a0420000-0000-4000-8000-000000000003'),false);
 assert.equal(validClassExport({...data,bytes:data.payload.length},classId),false);
 assert.equal(validClassExport({...data,counts:{pilot_students:0}},classId),false);
 assert.equal(validClassExport({...data,id:classId},classId),false);
 assert.equal(validClassExport(envelope({format:'unknown'}),classId),false);
 assert.equal(validClassExport(envelope({class:{id:classId,owner_id:'private-login'}}),classId),false);
 for(const table of ['pilot_display_devices','pilot_teachers','pilot_classes','pilot_class_exports']){
  const value=envelope({tables:{[table]:[]}});assert.equal(validClassExport({...value,counts:{[table]:0}},classId),false);
 }
});
test('export envelopes reject malformed, oversized and truncated data before download',()=>{
 const data=envelope();
 for(const value of [null,[],{...data,payload:'{'},{...data,sha256:'not-a-hash'},{...data,bytes:maxExportBytes+1},{...data,counts:[]},{...data,counts:{pilot_students:1,unexpected:0}},envelope({tables:null}),envelope({schema_revision:42})])assert.equal(validClassExport(value,classId),false);
 const many=envelope({tables:{pilot_students:Array(50001).fill(null)}});assert.equal(validClassExport({...many,counts:{pilot_students:50001}},classId),false);
});
