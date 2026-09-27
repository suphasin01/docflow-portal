// Pure projection/validation tests: no browser, credentials or database writes.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import vm from "node:vm";
const require = createRequire(import.meta.url);
const ts = require("typescript");
const source = readFileSync(new URL("../src/lib/company-card.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
const exports = {};
vm.runInNewContext(compiled, { exports, require, URL, window: { location: { origin: "https://example.com" } } });
const { companyCardData, publicCompanyCardSchema: schema, companyShareIdPattern, companyCardLink } = exports;
const company = { name: "บริษัททดสอบ", ownerId: "secret", createdBy: "secret", signerName: "private", signerPosition: "private", logoUrl: "https://tracker.example/image", id: "internal" };
const card = companyCardData(company);
assert.deepEqual(Object.keys(card).sort(), ["address", "email", "name", "nameEn", "phone", "taxId"]);
assert.equal(schema.safeParse(card).success, true);
for (const key of ["ownerId", "createdBy", "signerName", "signerPosition", "logoUrl", "id"]) {
  assert.equal(key in card, false);
  assert.equal(schema.safeParse({ ...card, [key]: "private" }).success, false);
}
assert.equal(schema.safeParse({ ...card, name: "" }).success, false);
assert.equal(schema.safeParse({ ...card, address: "x".repeat(2001) }).success, false);
assert.equal(schema.safeParse({ ...card, email: null }).success, false);
assert.equal(companyShareIdPattern.test("AbCdEfGh123456789012"), true);
assert.equal(companyShareIdPattern.test("../../companies/private"), false);
assert.equal(companyCardLink("AbCdEfGh123456789012"), "https://example.com/share/company?id=AbCdEfGh123456789012");
console.log("Company card: projection, private-field rejection, validation and link tests passed");
