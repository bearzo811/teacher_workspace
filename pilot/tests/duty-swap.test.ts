import test from 'node:test';
import assert from 'node:assert/strict';
import {swapDutyDraft,dutyDraftLoads} from '../lib/duty-swap';
import type {DutyJob,DutyAssignment} from '../lib/duty';
const jobs:DutyJob[]=[{id:'clean',name:'掃地',group:'clean',slots:2,weight:2,exclusive:false},{id:'carry',name:'餐桶',group:'carry',slots:1,weight:1,exclusive:false},{id:'board',name:'黑板',group:'clean',slots:1,weight:3,exclusive:true}];
const rows:DutyAssignment[]=[{day:'2026-11-27',job_id:'clean',slot:1,student_id:'a'},{day:'2026-11-27',job_id:'clean',slot:2,student_id:'b'},{day:'2026-11-27',job_id:'carry',slot:1,student_id:'a'},{day:'2026-11-27',job_id:'board',slot:1,student_id:'c'}];
test('duty draft swaps preserve slots and inputs and reject incompatible parallel work',()=>{
 const copy=structuredClone(rows),result=swapDutyDraft(rows,jobs,0,1);
 assert.equal(result.assignments?.[0].student_id,'b');assert.equal(result.assignments?.[1].student_id,'a');assert.deepEqual(rows,copy);
 assert.ok(swapDutyDraft(rows,jobs,0,3).error,'blackboard would also carry');
 assert.ok(swapDutyDraft(rows,jobs,1,2).error,'same cleaning group would repeat');
 assert.ok(swapDutyDraft(rows,jobs,0,2).error,'same person');assert.ok(swapDutyDraft(rows,jobs,-1,2).error);assert.ok(swapDutyDraft(rows,jobs,1,1).error);
});
test('cross-day swaps update weighted fairness totals and retain historical burden',()=>{
 const other=[rows[0],{...rows[3],day:'2026-11-30'}],result=swapDutyDraft(other,jobs,0,1);assert.ok(result.assignments);
 const totals=dutyDraftLoads(result.assignments!,jobs,[{id:'a',seat:1,name:'A'},{id:'c',seat:3,name:'C'}],[{student_id:'a',job_id:'carry',count:1,total_weight:1}]);
 assert.deepEqual(totals,[{student_id:'a',total_weight:4,counts:{carry:1,board:1}},{student_id:'c',total_weight:2,counts:{clean:1}}]);
});
