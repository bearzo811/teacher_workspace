import test from "node:test";
import assert from "node:assert/strict";
import {defaultRewardRules,validRewardRules} from "../lib/reward-rules";
test("reward template requires complete bounded integers and does not reward later passport completion more",()=>{
 assert.equal(validRewardRules(defaultRewardRules),true);
 for(const input of [null,[],{...defaultRewardRules,unknown:1},{...defaultRewardRules,routine_xp:1.5},{...defaultRewardRules,routine_xp:"2"},{...defaultRewardRules,level_base_xp:0},{...defaultRewardRules,passport_overdue_daily_coins:1},{...defaultRewardRules,passport_tuesday_coins:9}])assert.equal(validRewardRules(input),false);
 const missing={...defaultRewardRules} as Partial<typeof defaultRewardRules>;delete missing.routine_xp;assert.equal(validRewardRules(missing),false);
});
