import test from "node:test";
import assert from "node:assert/strict";
import {validPrintScope,checklistRows} from "../lib/debt-print";
test("print requires explicit valid student, term and non-future ordered dates",()=>{
 const scope={student:"00000000-0000-4000-8000-000000000001",term:"00000000-0000-4000-8000-000000000002",from:"2026-09-01",day:"2026-11-17"};
 assert.equal(validPrintScope(scope,"2026-11-17"),true);
 for(const value of [{...scope,student:undefined},{...scope,term:"anything"},{...scope,from:"2026-02-30"},{...scope,from:"2026-11-18"},{...scope,day:"2026-11-18"},{...scope,day:""}])assert.equal(validPrintScope(value,"2026-11-17"),false);
});
test("printed checklist preserves work, passport, reading order and state labels",()=>{
 const rows=checklistRows([{id:'same',label:'數習',status:'未訂正完成'}],{passports:[{id:'same',label:'國語 W3'}],reading:[{id:'same',label:'讀報 9月',status:'缺家長'}]});
 assert.deepEqual(rows.map(item=>item.status),['未訂正完成','未開始','缺家長']);assert.equal(new Set(rows.map(item=>item.id)).size,3);
 assert.deepEqual(checklistRows([],{passports:[],reading:[]}),[]);
});
