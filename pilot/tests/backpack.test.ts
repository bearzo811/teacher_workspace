import test from "node:test";
import assert from "node:assert/strict";
import {allowedRewardActions,backpackPage} from "../lib/backpack";
test("teacher backpack actions preserve requested-before-redemption and terminal states",()=>{
 assert.deepEqual(allowedRewardActions('available'),['request','revoke']);assert.deepEqual(allowedRewardActions('requested'),['redeem','return','revoke']);
 assert.deepEqual(allowedRewardActions('redeemed'),[]);assert.deepEqual(allowedRewardActions('revoked'),[]);
 assert.equal(backpackPage(undefined),1);assert.equal(backpackPage('20'),20);
 for(const value of ['0','21','1.5','-1','1e1',null])assert.equal(backpackPage(value),null);
});
