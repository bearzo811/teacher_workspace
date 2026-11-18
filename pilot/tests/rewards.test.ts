import test from "node:test";
import assert from "node:assert/strict";
import {rewardAdjustment,rewardDisplay,rewardLevel} from "../lib/rewards";
test("virtual reward amounts are bounded integers and negative net is not discarded",()=>{
 for(const value of ['1.5','1e2','',null,'10001','-10001'])assert.equal(rewardAdjustment(value),null);
 assert.equal(rewardAdjustment('-10000'),-10000);assert.equal(rewardAdjustment('0'),0);assert.equal(rewardAdjustment('+8'),8);
 assert.deepEqual(rewardDisplay('-3','2'),{coinNet:-3,coins:0,xp:2});assert.equal(rewardDisplay('invalid',0),null);assert.equal(rewardDisplay(0,-1),null);
});
test("level progression uses cumulative triangular thresholds and class-specific base",()=>{
 assert.deepEqual(rewardLevel(0,100),{level:1,currentXp:0,requiredXp:100,remainingXp:100,percent:0});
 assert.equal(rewardLevel(99,100)?.level,1);assert.equal(rewardLevel(100,100)?.level,2);
 assert.equal(rewardLevel(299,100)?.level,2);assert.equal(rewardLevel(300,100)?.level,3);
 assert.equal(rewardLevel(100,50)?.currentXp,50);assert.equal(rewardLevel(100,50)?.requiredXp,100);
 for(const xp of [0,1,999,1000000000])for(const base of [1,100,10000]){
  const result=rewardLevel(xp,base)!;assert.ok(result.currentXp>=0&&result.currentXp<result.requiredXp);assert.ok(result.level>=1);
 }
 for(const [xp,base] of [[-1,100],[1.5,100],[100,0],[100,10001],[Infinity,100],[1000000001,1]])assert.equal(rewardLevel(xp,base),null);
});
