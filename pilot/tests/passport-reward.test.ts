import test from "node:test";
import assert from "node:assert/strict";
import {passportReward} from "../lib/passport-reward";
import {defaultRewardRules} from "../lib/reward-rules";
const term={id:"t",name:"測試",active:true,start_date:"2026-09-02",end_date:"2027-01-20"};
test("passport completion rewards early work at Monday rate and use actual weekdays, not a shifted school-day index",()=>{
 assert.deepEqual(passportReward(term,13,"2026-11-18",defaultRewardRules),{coins:8,reason:"early"});
 for(const [index,coins] of [8,6,4,2,1,0,0].entries())assert.equal(passportReward(term,12,`2026-11-${16+index}`,defaultRewardRules)?.coins,coins);
 assert.deepEqual(passportReward(term,12,"2026-11-23",defaultRewardRules),{coins:0,reason:"late"});
});
test("partial first and last weeks use real term boundaries",()=>{
 assert.deepEqual(passportReward(term,1,"2026-09-01",defaultRewardRules),{coins:8,reason:"early"});
 assert.equal(passportReward(term,1,"2026-09-02",defaultRewardRules)?.coins,4);
 assert.equal(passportReward(term,21,"2027-01-20",defaultRewardRules)?.coins,4);
 assert.deepEqual(passportReward(term,21,"2027-01-21",defaultRewardRules),{coins:0,reason:"late"});
 for(const week of [0,22,26,1.5])assert.equal(passportReward(term,week,"2026-11-18",defaultRewardRules),null);
 assert.equal(passportReward(term,1,"2026-02-30",defaultRewardRules),null);
});
