import test from "node:test";
import assert from "node:assert/strict";
import {readingMonths,readingMonthOverdue,validReadingStatus,readingSummary} from "../lib/reading";
test("reading months follow actual term, include January and exclude summer",()=>{
 assert.deepEqual(readingMonths('2026-08-31','2027-01-20'),['2026-09-01','2026-10-01','2026-11-01','2026-12-01','2027-01-01']);
 assert.deepEqual(readingMonths('2027-02-15','2027-06-30'),['2027-02-01','2027-03-01','2027-04-01','2027-05-01','2027-06-01']);
 assert.deepEqual(readingMonths('2026-07-01','2026-08-31'),[]);assert.deepEqual(readingMonths('2026-02-30','2026-03-01'),[]);
 assert.equal(readingMonthOverdue('2026-09-01','2026-09-30'),false);assert.equal(readingMonthOverdue('2026-09-01','2026-10-01'),true);
 assert.equal(readingMonthOverdue('2026-12-01','2027-01-01'),true);assert.equal(readingMonthOverdue('2026-09-02','2026-10-01'),false);
 assert.equal(validReadingStatus('completed'),true);assert.equal(validReadingStatus('missing'),false);
});
test("reading summary does not count current or future months as overdue",()=>{
 const students=[{id:'a',name:'A'},{id:'b',name:'B'}];const months=['2026-09-01','2026-10-01','2026-11-01'];
 const checks=[{student_id:'a',kind:'newspaper',month:'2026-09-01',status:'completed'},{student_id:'b',kind:'newspaper',month:'2026-09-01',status:'missing_parent'},{student_id:'b',kind:'reflection',month:'2026-10-01',status:'completed'},{student_id:'unknown',kind:'newspaper',month:'2026-10-01',status:'completed'}];
 const summary=readingSummary(students,checks,months,'newspaper','2026-10-31');
 assert.equal(summary.overdueCount,1);assert.deepEqual(summary.overdue[0].missing.map(student=>student.id),['b']);assert.equal(summary.months[1].overdue,false);assert.equal(summary.months[1].completed,0);
 assert.equal(readingSummary(students,checks,months,'newspaper','2026-11-01').overdueCount,3);
 assert.equal(readingSummary([],checks,months,'newspaper','2026-11-01').overdueCount,0);
});
