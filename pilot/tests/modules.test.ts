import assert from "node:assert/strict";
import { test } from "node:test";
import { modules, moduleEnabled, validateModules } from "../lib/modules";

test("optional modules accept empty selection, reject unknown IDs and normalize duplicates", () => {
  assert.deepEqual(validateModules([]), []);
  assert.deepEqual(validateModules(["reading", "homework", "reading"]), ["homework", "reading"]);
  assert.equal(validateModules(["admin"]), null);
  assert.equal(validateModules([{}]), null);
  assert.equal(moduleEnabled(null, "passport"), false);
  assert.equal(moduleEnabled(["homework"], "passport"), false);
  assert.equal(moduleEnabled(["passport"], "passport"), true);
  assert.equal(new Set(modules.map(module => module.id)).size, modules.length);
});
