import test from 'node:test';
import assert from 'node:assert/strict';
import {exportFixture} from '../app/display/preview/export-fixture';
import {verifyIsolatedExport} from '../scripts/isolated-export-verifier';
test('isolated restore rejects wrong checksums and partial visual fixtures rather than certifying them',async()=>{
 const fixture=exportFixture(1);
 await assert.rejects(verifyIsolatedExport({...fixture.envelope,sha256:'0'.repeat(64)},fixture.classId),/checksum/);
 await assert.rejects(verifyIsolatedExport(fixture.envelope,fixture.classId),/table set does not match/);
});
