import test from 'node:test';
import assert from 'node:assert/strict';
import {coveredDuties,coveredDutyHistory,substituteOpportunities,type PublishedDuty,type DutyCover} from '../lib/substitute';
const duties:PublishedDuty[]=[
 {id:'a',student_id:'absent',job_id:'carry',job_name:'餐桶（二）',group_key:'餐桶',weight:1},
 {id:'b',student_id:'absent',job_id:'sweep',job_name:'掃前',group_key:'中午工作',weight:2},
 {id:'c',student_id:'helper',job_id:'mop',job_name:'拖前',group_key:'中午工作',weight:2},
];
const claim:DutyCover={id:'cover',absent_student_id:'absent',helper_student_id:'helper',status:'claimed',assignment_ids:['a','b']};
test('absence bundles published parallel jobs and a helper keeps their own work',()=>{
 const original=structuredClone(duties);
 const opportunities=substituteOpportunities(duties,new Set(['absent','no-duty']),[]);
 assert.equal(opportunities.length,1);assert.deepEqual(opportunities[0].jobs.map(j=>j.id),['a','b']);
 const display=coveredDuties(duties,[claim],'display');
 assert.deepEqual(display.map(j=>j.student_id),['helper','helper','helper']);
 assert.deepEqual(display.map(j=>j.cover_id),['cover','cover',null]);
 assert.deepEqual(duties,original,'published assignments remain immutable');
 assert.deepEqual(coveredDuties(duties,[claim],'history').map(j=>j.student_id),['absent','absent','helper']);
});
test('only approved covers transfer fairness burden and cancellation restores it',()=>{
 assert.deepEqual(coveredDuties(duties,[{...claim,status:'approved'}],'history').map(j=>j.student_id),['helper','helper','helper']);
 for(const purpose of ['display','history'] as const)assert.deepEqual(coveredDuties(duties,[{...claim,status:'cancelled'}],purpose).map(j=>j.student_id),duties.map(j=>j.student_id));
 assert.equal(substituteOpportunities(duties,new Set(['absent']),[claim])[0].cover?.id,'cover');
});
test('ambiguous or foreign assignment claims fail closed',()=>{
 for(const invalid of [
  {...claim,helper_student_id:'absent'},
  {...claim,assignment_ids:['c']},
  {...claim,assignment_ids:['missing']},
  {...claim,assignment_ids:['a','a']},
  {...claim,assignment_ids:[]},
 ])assert.throws(()=>coveredDuties(duties,[invalid],'display'));
 assert.throws(()=>coveredDuties(duties,[claim,{...claim,id:'other'}],'display'));
 assert.throws(()=>coveredDuties([...duties,duties[0]],[],'display'));
 assert.throws(()=>substituteOpportunities(duties,new Set(['absent']),[{...claim,assignment_ids:['a']},{...claim,id:'other',assignment_ids:['b']}]));
});
test('future fairness history credits actual approved extra work without inventing makeup',()=>{
 const before=coveredDutyHistory(duties,[claim]);
 assert.equal(before.filter(row=>row.student_id==='absent').reduce((n,row)=>n+row.total_weight,0),3);
 const after=coveredDutyHistory(duties,[{...claim,status:'approved'}]);
 assert.equal(after.some(row=>row.student_id==='absent'),false);
 assert.equal(after.filter(row=>row.student_id==='helper').reduce((n,row)=>n+row.total_weight,0),5);
 assert.equal(after.reduce((n,row)=>n+row.count,0),3);
 assert.deepEqual(coveredDutyHistory(duties,[{...claim,status:'cancelled'}]),before);
 assert.throws(()=>coveredDutyHistory([{...duties[0],weight:NaN}],[]));
});
