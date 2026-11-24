import test from 'node:test';
import assert from 'node:assert/strict';
import {taipeiTimestamp} from '../lib/time';
test('pairing expiry text is deterministic across locale/timezone renderers',()=>{
 assert.equal(taipeiTimestamp('2026-11-24T04:10:00.000Z'),'2026-11-24 12:10:00');
 assert.equal(taipeiTimestamp('2026-12-31T20:00:00Z'),'2027-01-01 04:00:00');
 assert.equal(taipeiTimestamp('2026-11-24T12:10:00+08:00'),'2026-11-24 12:10:00');
 assert.equal(taipeiTimestamp('invalid'),'時間無法顯示');
});
