import test from "node:test";
import assert from "node:assert/strict";
import {validWeeks,passportWeeks} from "../lib/passports";
test("passport weeks are inclusive, bounded and respect term length",()=>{
 assert.deepEqual(passportWeeks(3,5),[3,4,5]);assert.deepEqual(passportWeeks(1,1),[1]);
 for(const [first,last] of [[0,3],[4,3],[1,26],[1.5,3],[1,NaN]]){assert.equal(validWeeks(first,last),false);assert.deepEqual(passportWeeks(first,last),[]);}
 assert.equal(validWeeks(3,16,15),false);assert.equal(validWeeks(3,16,20),true);
});
