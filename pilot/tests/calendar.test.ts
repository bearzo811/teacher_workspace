import assert from "node:assert/strict";
import { test } from "node:test";
import { validDate, validRange, schoolDay, termWeek, nextSchoolDay, type Term } from "../lib/calendar";
const term: Term = {id:"test",name:"測試",start_date:"2026-09-01",end_date:"2027-01-22",active:true};
test("calendar validates real dates and bounded inclusive ranges",()=>{
  assert.equal(validDate("2026-02-29"),false);
  assert.equal(validDate("2028-02-29"),true);
  assert.equal(validDate("bad"),false);
  assert.equal(validRange("2026-09-01","2026-08-31"),false);
  assert.equal(validRange("2026-09-01","2028-08-31"),false);
  assert.equal(validRange(term.start_date,term.end_date),true);
});
test("Tuesday start is week one, Mondays change weeks, holidays do not shift weeks",()=>{
  assert.equal(termWeek("2026-08-31",term),null);
  assert.equal(termWeek("2026-09-01",term),1);
  assert.equal(termWeek("2026-09-06",term),1);
  assert.equal(termWeek("2026-09-07",term),2);
  assert.equal(termWeek("2027-01-22",term),21);
  assert.equal(termWeek("2027-01-23",term),null);
});
test("school days respect boundaries, overrides and next-school-day due dates",()=>{
  const changes=[{day:"2026-09-07",is_school_day:false,note:"放假"},{day:"2026-09-05",is_school_day:true,note:"補課"}];
  assert.equal(schoolDay("2026-08-31",term,[]),false);
  assert.equal(schoolDay("2026-09-01",term,[]),true);
  assert.equal(schoolDay("2026-09-05",term,[]),false);
  assert.equal(schoolDay("2026-09-05",term,changes),true);
  assert.equal(nextSchoolDay("2026-09-04",term,changes),"2026-09-05");
  assert.equal(nextSchoolDay("2026-09-05",term,changes),"2026-09-08");
  assert.equal(nextSchoolDay("2026-08-20",term,[]),"2026-09-01");
  assert.equal(nextSchoolDay("2027-01-22",term,[]),null);
});
