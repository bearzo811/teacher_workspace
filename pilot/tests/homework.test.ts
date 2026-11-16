import {test} from "node:test";
import assert from "node:assert/strict";
import {validHomeworkStatus,isHandedIn} from "../lib/homework";
test("handed-in does not require teacher confirmation or correction completion",()=>{
 assert.equal(isHandedIn("missing"),false);
 for(const status of ["pending","correction","completed"] as const) assert.equal(isHandedIn(status),true);
 assert.equal(validHomeworkStatus("unknown"),false);
 assert.equal(validHomeworkStatus("pending"),true);
});
