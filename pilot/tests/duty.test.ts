import test from 'node:test';
import assert from 'node:assert/strict';
import {planDuty,nineStudentDutyTemplate,parseDutyJobs,type DutyStudent} from '../lib/duty';
import {schoolDay,type Term} from '../lib/calendar';
const term:Term={id:'term',name:'測試',start_date:'2026-09-01',end_date:'2027-01-22',active:true};
const roster=(n:number):DutyStudent[]=>Array.from({length:n},(_,i)=>({id:`student-${i+1}`,seat:i+1,name:`虛構${i+1}`}));
test('nine-person duty covers both classes, preserves parallel cleaning and isolates blackboard duty',()=>{
 const result=planDuty(term,[],roster(9),nineStudentDutyTemplate);
 assert.deepEqual(result.issues,[]);assert.ok(result.days.length>90);
 for(const day of result.days){
  const rows=result.assignments.filter(a=>a.day===day),blackboard=rows.find(a=>a.job_id==='blackboard')!;
  assert.equal(rows.filter(a=>a.student_id===blackboard.student_id).length,1);
  for(const job of nineStudentDutyTemplate)assert.equal(rows.filter(a=>a.job_id===job.id).length,job.slots);
  const carry=rows.filter(a=>a.job_id.startsWith('carry-')||a.job_id.startsWith('cart-'));
  assert.equal(carry.length,8);assert.equal(new Set(carry.map(a=>a.student_id)).size,8);
  const cleaning=rows.filter(a=>a.job_id.startsWith('clean-'));
  assert.equal(cleaning.length,6);assert.ok(cleaning.every(c=>carry.some(a=>a.student_id===c.student_id)));
  assert.equal(rows.filter(a=>a.job_id==='garbage').length,2);
 }
 for(const job of nineStudentDutyTemplate){const counts=result.loads.map(s=>s.counts[job.id]??0);assert.ok(Math.max(...counts)-Math.min(...counts)<=2,`${job.name} stays balanced: ${counts}`);}
 assert.deepEqual(planDuty(term,[],[...roster(9)].reverse(),nineStudentDutyTemplate),result,'input row ordering does not change the plan');
});
test('duty follows actual school dates, includes makeup days, and does not reset at month boundaries',()=>{
 const overrides=[{day:'2026-09-04',is_school_day:false,note:'holiday'},{day:'2026-09-05',is_school_day:true,note:'makeup'}];
 const result=planDuty(term,overrides,roster(15),[{id:'board',name:'黑板',group:'值日',slots:2,weight:1,exclusive:false}]);
 assert.deepEqual(result.issues,[]);assert.ok(!result.days.includes('2026-09-04'));assert.ok(result.days.includes('2026-09-05'));
 assert.ok(result.days.every(day=>schoolDay(day,term,overrides)));
 assert.equal(new Set(result.assignments.map(a=>`${a.day}:${a.job_id}:${a.slot}`)).size,result.assignments.length);
 const counts=result.loads.map(s=>s.counts.board??0);assert.ok(Math.max(...counts)-Math.min(...counts)<=1);
});
test('duty refuses impossible staffing and supports a one-student custom class',()=>{
 assert.ok(planDuty(term,[],roster(1),nineStudentDutyTemplate).issues.length);
 assert.deepEqual(planDuty(term,[],roster(1),nineStudentDutyTemplate).assignments,[]);
 const one=planDuty(term,[],roster(1),[{id:'board',name:'黑板',group:'工作',slots:1,weight:2,exclusive:true}]);
 assert.deepEqual(one.issues,[]);assert.equal(one.assignments.length,one.days.length);
 assert.ok(planDuty(term,[],roster(9),[{...nineStudentDutyTemplate[0],slots:10}]).issues.length);
 assert.ok(planDuty(term,[],roster(9),[]).issues.length);
 assert.ok(planDuty({...term,end_date:'2026-08-01'},[],roster(9),nineStudentDutyTemplate).issues.length);
 assert.ok(planDuty(term,[],[...roster(9),roster(9)[0]],nineStudentDutyTemplate).issues.some(x=>x.includes('重複')));
});
test('historical duty burden affects allocation without modifying input history',()=>{
 const history=[{student_id:'student-1',job_id:'board',count:20,total_weight:40}];
 const small={...term,end_date:'2026-09-01'};
 const result=planDuty(small,[],roster(2),[{id:'board',name:'黑板',group:'工作',slots:1,weight:2,exclusive:false}],history);
 assert.equal(result.assignments[0].student_id,'student-2');assert.equal(history[0].count,20);
});
test('duty input parsing rejects malformed payloads and caps large publications',()=>{
 assert.equal(parseDutyJobs(null),null);assert.equal(parseDutyJobs([{}]),null);assert.equal(parseDutyJobs([{...nineStudentDutyTemplate[0],exclusive:'yes'}]),null);
 const parsed=parseDutyJobs([{...nineStudentDutyTemplate[0],name:' 黑板 ',group:' 工作 ',untrusted:'ignored'}])!;
 assert.equal(parsed[0].name,'黑板');assert.equal(parsed[0].group,'工作');assert.equal('untrusted' in parsed[0],false);
 const jobs=Array.from({length:6},(_,i)=>({id:`group-${i}`,name:'工作',group:`組${i}`,slots:15,weight:1,exclusive:false}));
 const huge=planDuty({...term,start_date:'2026-01-01',end_date:'2026-12-31'},[],roster(15),jobs);
 assert.ok(huge.issues.some(issue=>issue.includes('20,000')));assert.deepEqual(huge.assignments,[]);
 const weekend=planDuty({...term,start_date:'2026-09-05',end_date:'2026-09-06'},[],roster(1),[{id:'board',name:'黑板',group:'工作',slots:1,weight:1,exclusive:false}]);
 assert.ok(weekend.issues.some(issue=>issue.includes('沒有上課日')));
});
