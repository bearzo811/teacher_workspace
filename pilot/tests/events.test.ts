import {test} from "node:test";
import assert from "node:assert/strict";
import {daysUntil,upcomingEvents,type CalendarEvent} from "../lib/events";
const event=(id:string,day:string,extra:Partial<CalendarEvent>={}):CalendarEvent=>({id,title:id,day,note:"",countdown:true,archived:false,...extra});
test("countdowns include today and future years regardless of displayed month",()=>{
  const list=[event("jan","2027-01-15"),event("today","2026-11-12"),event("past","2026-11-11"),event("off","2026-11-13",{countdown:false}),event("removed","2026-11-13",{archived:true})];
  assert.deepEqual(upcomingEvents(list,"2026-11-12").map(item=>item.id),["today","jan"]);
  assert.equal(daysUntil("2026-11-12","2026-11-12"),0);
  assert.equal(daysUntil("2026-12-31","2027-01-01"),1);
  assert.equal(daysUntil("2028-02-28","2028-03-01"),2);
  assert.equal(daysUntil("bad","2027-01-01"),null);
  assert.deepEqual(upcomingEvents(list,"bad"),[]);
  assert.equal(list[0].id,"jan","sorting must not mutate input");
});
