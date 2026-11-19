import test from "node:test";
import assert from "node:assert/strict";
import {shopInteger,validShopKind} from "../lib/shop";
test("shop amounts are bounded integers; only -1 means unlimited stock",()=>{
 assert.equal(shopInteger('-1',-1,100000),-1);assert.equal(shopInteger('0',0,10000),0);
 for(const value of ['-2','100001','1.5','1e2','',null])assert.equal(shopInteger(value,-1,100000),null);
 assert.equal(shopInteger('0',1,1000),null);assert.equal(validShopKind('privilege'),true);assert.equal(validShopKind('physical'),true);assert.equal(validShopKind('other'),false);
});
