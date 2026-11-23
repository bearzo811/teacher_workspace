import test from 'node:test';
import assert from 'node:assert/strict';
import {orderDebt} from '../lib/debt-order';
test('personal debt order preserves overrides and new default order, without resurrecting stale debt',()=>{
 const items=[{id:'new'},{id:'old'},{id:'passport'},{id:'reading'}];
 assert.deepEqual(orderDebt(items).map(x=>x.id),items.map(x=>x.id));
 assert.deepEqual(orderDebt(items,['deleted','passport','old','passport']).map(x=>x.id),['passport','old','new','reading']);
 assert.deepEqual(items.map(x=>x.id),['new','old','passport','reading']);
});
