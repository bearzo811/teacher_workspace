import {test} from "node:test";
import assert from "node:assert/strict";
import {studentWork,type DebtAssignment} from "../lib/debts";
const item=(id:string,day:string,extra:Partial<DebtAssignment>={}):DebtAssignment=>({id,content:id,contact_day:day,due_day:day,workbook_id:"book",blocks_break:true,blocks_shop:true,...extra});
test("debt overview sorts latest first, excludes future/archive, and preserves completed details",()=>{
 const items=[item("old","2026-11-10"),item("new","2026-11-12"),item("done","2026-11-11"),item("future","2026-11-20"),item("gone","2026-11-13",{archived:true})];
 const checks=[{assignment_id:"new",student_id:"a",status:"pending"},{assignment_id:"done",student_id:"a",status:"completed"},{assignment_id:"old",student_id:"b",status:"completed"}];
 const work=studentWork(items,checks,"a","2026-11-16");
 assert.deepEqual(work.unfinished.map(item=>item.id),["new","old"]);
 assert.equal(work.all.length,3);assert.equal(work.missing,1);assert.equal(work.pending,1);
 assert.equal(work.blocksBreak,true);assert.equal(items[0].id,"old");
});
test("break and shop restrictions are independent and completed tasks never restrict",()=>{
 const items=[item("signature","2026-11-10",{blocks_break:false}),item("done","2026-11-11")];
 const work=studentWork(items,[{assignment_id:"done",student_id:"a",status:"completed"}],"a","2026-11-16");
 assert.equal(work.blocksBreak,false);assert.equal(work.blocksShop,true);
 const clear=studentWork([],[],"a","2026-11-16");assert.equal(clear.blocksBreak,false);assert.equal(clear.blocksShop,false);
});
