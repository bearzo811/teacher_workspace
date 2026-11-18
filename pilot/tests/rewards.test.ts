import test from "node:test";
import assert from "node:assert/strict";
import {rewardAdjustment,rewardDisplay} from "../lib/rewards";
test("virtual reward amounts are bounded integers and negative net is not discarded",()=>{
 for(const value of ['1.5','1e2','',null,'10001','-10001'])assert.equal(rewardAdjustment(value),null);
 assert.equal(rewardAdjustment('-10000'),-10000);assert.equal(rewardAdjustment('0'),0);assert.equal(rewardAdjustment('+8'),8);
 assert.deepEqual(rewardDisplay('-3','2'),{coinNet:-3,coins:0,xp:2});assert.equal(rewardDisplay('invalid',0),null);assert.equal(rewardDisplay(0,-1),null);
});
