import test from "node:test";
import assert from "node:assert/strict";
import {workbookProgress} from "../lib/workbook-progress";
test("workbook percentages count completed only, retain handed-in distinctions and exclude archive/future",()=>{
 const students=[{id:"s",seat:1,name:"測試"}];
 const assignments=['a','b','c','d','future','archived'].map((id,index)=>({id,content:id,contact_day:"2026-09-01",due_day:index===4?"2026-12-01":"2026-09-02",archived:index===5}));
 const checks=['completed','pending','correction','missing','completed','completed'].map((status,index)=>({assignment_id:assignments[index].id,student_id:"s",status}));
 const result=workbookProgress(students,assignments,checks,"2026-11-18");
 assert.equal(result.items.length,4);assert.equal(result.rows[0].completed,1);assert.equal(result.rows[0].handedIn,3);assert.equal(result.rows[0].percent,25);
 assert.equal(workbookProgress(students,[],checks,"2026-11-18").rows[0].percent,null);
 assert.equal(workbookProgress(students,assignments,[],"2026-11-18").rows[0].percent,0);
 assert.equal(workbookProgress(students,assignments,[{assignment_id:"a",student_id:"s",status:"invalid"}],"2026-11-18").rows[0].statuses[0],"missing");
});
