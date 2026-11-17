import test from "node:test";
import assert from "node:assert/strict";
import {studentLearning} from "../lib/learning-debts";
const term={id:'t',name:'上學期',start_date:'2026-09-01',end_date:'2027-01-22',active:true};
test("learning detail includes current passport week but only ended reading months",()=>{
 const plans=[{id:'p',name:'國語',first_week:3,last_week:5,archived:false},{id:'archived',name:'停用',first_week:1,last_week:5,archived:true}];
 const checks=[{passport_id:'p',student_id:'a',week:3,completed:true},{passport_id:'p',student_id:'b',week:4,completed:true}];
 const reading=[{student_id:'a',kind:'newspaper',month:'2026-09-01',status:'completed'},{student_id:'a',kind:'reflection',month:'2026-09-01',status:'missing_parent'}];
 assert.deepEqual(studentLearning(term,'2026-09-22','a',plans,checks,reading,true).passports.map(item=>item.week),[4]);
 assert.equal(studentLearning(term,'2026-09-30','a',plans,checks,reading,true).reading.length,0);
 const result=studentLearning(term,'2026-10-01','a',plans,checks,reading,true);
 assert.deepEqual(result.passports.map(item=>item.week),[4,5]);assert.equal(result.reading.length,1);assert.equal(result.reading[0].status,'缺家長');
 assert.deepEqual(studentLearning(term,'2026-08-28','a',plans,checks,reading,true),{passports:[],reading:[]});
 assert.equal(studentLearning(term,'2027-02-01','a',plans,checks,reading,true).passports.length,2);
 assert.equal(studentLearning(term,'2026-10-01','a',plans,checks,reading,false).reading.length,0);
});
