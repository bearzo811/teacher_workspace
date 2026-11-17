import test from "node:test";
import assert from "node:assert/strict";
import {routineProgress,validRoutine} from "../lib/routines";
test("routine totals exclude absences without losing their saved completions",()=>{
 const roster=[{id:"a",seat:1,name:"A"},{id:"b",seat:2,name:"B"},{id:"c",seat:3,name:"C"}];
 const checks=[{student_id:"a",task_key:"morning_cleaning",completed:true},{student_id:"b",task_key:"morning_cleaning",completed:true},{student_id:"unknown",task_key:"morning_cleaning",completed:true},{student_id:"c",task_key:"noon_cleaning",completed:true}];
 const result=routineProgress(roster,checks,[{student_id:"b",absent:true},{student_id:"c",absent:false}],"morning_cleaning");
 assert.equal(result.total,2);assert.equal(result.completed,1);assert.deepEqual(result.missing.map(student=>student.id),["c"]);
 assert.equal(result.roster[1].completed,true);assert.equal(result.roster[1].absent,true);
 assert.equal(routineProgress([],checks,[],"morning_cleaning").completed,0);
 assert.equal(routineProgress(roster,checks,roster.map(student=>({student_id:student.id,absent:true})),"morning_cleaning").total,0);
 assert.equal(validRoutine("morning_cleaning"),true);assert.equal(validRoutine("absence"),false);assert.equal(validRoutine("summer_homework_submitted"),false);
});
