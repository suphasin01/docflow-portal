// Dry-run Rules API tests. All document lookups are mocked; no data is written
// and no ruleset is published. Uses an already authenticated Firebase CLI.
// node scripts/test-workspace-rules.mjs /path/to/firebase-tools contact@example.com
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import assert from "node:assert/strict";

const require = createRequire(import.meta.url);
const cliPath = process.argv[2];
const accountEmail = process.argv[3];
if (!cliPath || !accountEmail) throw new Error("Pass firebase-tools package path and signed-in account email");
const cliAuth = require(resolve(cliPath, "lib/auth.js"));
const account = cliAuth.getAllAccounts().find((a) => a.user.email === accountEmail);
if (!account) throw new Error("Sign in to the Firebase CLI first");
const token = await cliAuth.getAccessToken(account.tokens.refresh_token, ["https://www.googleapis.com/auth/cloud-platform"]);
const rules = readFileSync(new URL("../firestore.rules", import.meta.url), "utf8");
const config = readFileSync(new URL("../src/config/workspace.ts", import.meta.url), "utf8");
const workspace = config.match(/WORKSPACE_COMPANY_ID = "([^"]+)"/)[1];
assert.ok(rules.includes('companyId == "' + workspace + '"'), "Rules and client workspace IDs must match");
const root = "/databases/(default)/documents/";
const cases = [];
const labels = [];
const identities = [
  { name: "anonymous", auth: null, approved: false },
  { name: "pending", status: "pending", approved: false },
  { name: "revoked", status: "rejected", approved: false },
  { name: "legacy-user", status: "approved", role: "user", approved: true },
  { name: "admin", status: "approved", role: "admin", approved: true },
  { name: "bootstrap", email: "beyonddevtechsolution@gmail.com", approved: true },
  { name: "unverified", status: "approved", verified: false, approved: false },
  { name: "password-bootstrap", email: "beyonddevtechsolution@gmail.com", provider: "password", approved: false },
];
function add(identity, label, method, path, oldData, newData, allowed) {
  const auth = identity.auth === null ? null : {
    uid: identity.name,
    token: { email: identity.email ?? identity.name + "@example.com",
      email_verified: identity.verified ?? true,
      firebase: { sign_in_provider: identity.provider ?? "google.com" } },
  };
  labels.push(identity.name + ": " + label);
  cases.push({
    expectation: allowed ? "ALLOW" : "DENY",
    request: { auth, method, path: root + path, ...(newData ? { resource: { data: newData } } : {}) },
    ...(oldData ? { resource: { data: oldData } } : {}),
    functionMocks: [
      { function: "exists", args: [{ exactValue: root + "accessControl/" + identity.name }], result: { value: !!identity.status } },
      { function: "get", args: [{ exactValue: root + "accessControl/" + identity.name }], result: { value: { data: { status: identity.status ?? "pending", role: identity.role ?? "user" } } } },
    ],
  });
}
for (const identity of identities) {
  const ok = identity.approved;
  add(identity, "read shared company", "get", "companies/" + workspace, { name: "Beyond", ownerId: "original-owner" }, null, ok);
  add(identity, "read another company", "get", "companies/private-company", { ownerId: identity.name }, null, false);
  add(identity, "create company", "create", "companies/new-company", null, { ownerId: identity.name, createdBy: identity.name }, false);
  add(identity, "edit shared company", "update", "companies/" + workspace, { name: "Before", ownerId: "original" }, { name: "After", ownerId: "original" }, ok);
  add(identity, "retarget company owner", "update", "companies/" + workspace, { ownerId: "original" }, { ownerId: identity.name }, false);
  add(identity, "archive shared company", "update", "companies/" + workspace, { archived: false }, { archived: true }, false);
  for (const collection of ["documents", "products", "contacts", "customers", "vendors", "payments", "documentItems"]) {
    const data = { companyId: workspace, createdBy: "another-owner", createdAt: "original-time", updatedAt: "old", name: "old" };
    add(identity, "read " + collection, "get", collection + "/example", data, null, ok);
    add(identity, "create " + collection, "create", collection + "/example", null, { ...data, createdBy: identity.name }, ok);
    add(identity, "collaborative edit " + collection, "update", collection + "/example", data, { ...data, name: "new" }, ok);
    add(identity, "retarget " + collection, "update", collection + "/example", data, { ...data, companyId: "private-company" }, false);
    add(identity, "import private " + collection, "update", collection + "/example", { ...data, companyId: "private-company" }, data, false);
    add(identity, "rewrite author " + collection, "update", collection + "/example", data, { ...data, createdBy: identity.name }, false);
    add(identity, "read private " + collection, "get", collection + "/example", { ...data, companyId: "private-company" }, null, false);
  }
  add(identity, "read settings", "get", "settings/" + workspace, {}, null, ok);
  add(identity, "write settings", "create", "settings/" + workspace, null, { prefix: "INV" }, ok);
  add(identity, "list members", "list", "accessControl/example", null, null, ok);
  add(identity, "approve member", "create", "accessControl/new-member", null, { status: "approved", role: "admin" }, ok);
  add(identity, "self approve", "create", "accessControl/" + identity.name, null, { status: "approved", role: "admin" }, ok);
  add(identity, "revoke member", "update", "accessControl/member", { status: "approved" }, { status: "rejected" }, ok);
  add(identity, "list requests", "list", "accessRequests/example", null, null, ok);
  add(identity, "reject request", "update", "accessRequests/member", { status: "pending" }, { status: "rejected" }, ok);
  add(identity, "create decision for legacy member", "create", "accessRequests/legacy-member", null, { uid: "legacy-member", status: "rejected" }, ok);
}
const pending = identities.find((i) => i.name === "pending");
const publicCard = { schemaVersion: 1, card: { name: "Company", nameEn: "", taxId: "123", address: "Address", phone: "0123", email: "office@example.com" } };
for (const identity of identities) {
  const path = "publicCompanyCards/AbCdEfGh123456789012";
  add(identity, "read published card", "get", path, publicCard, null, true);
  add(identity, "enumerate public cards denied", "list", path, publicCard, null, false);
  add(identity, "publish card", "create", path, null, publicCard, identity.approved);
  add(identity, "update card", "update", path, publicCard, publicCard, identity.approved);
  add(identity, "revoke card", "delete", path, publicCard, null, identity.approved);
  add(identity, "publish signer denied", "create", path, null, { ...publicCard, card: { ...publicCard.card, signerName: "private" } }, false);
  add(identity, "publish identity denied", "create", path, null, { ...publicCard, createdBy: "private" }, false);
  add(identity, "tracking logo denied", "create", path, null, { ...publicCard, card: { ...publicCard.card, logoUrl: "https://tracking.example/logo.png" } }, false);
  add(identity, "SVG logo denied", "create", path, null, { ...publicCard, card: { ...publicCard.card, logoUrl: "data:image/svg+xml;base64,PHN2Zz4=" } }, false);
  add(identity, "oversize field denied", "create", path, null, { ...publicCard, card: { ...publicCard.card, address: "x".repeat(2001) } }, false);
  add(identity, "invalid share id denied", "create", "publicCompanyCards/guessable", null, publicCard, false);
  add(identity, "private share settings", "get", "companyCardSettings/" + workspace, { shareId: "AbCdEfGh123456789012" }, null, identity.approved);
  add(identity, "private share settings write", "create", "companyCardSettings/" + workspace, null, { shareId: "AbCdEfGh123456789012" }, identity.approved);
  add(identity, "other workspace share settings denied", "create", "companyCardSettings/other", null, { shareId: "AbCdEfGh123456789012" }, false);
}
const ownRequest = { uid: "pending", email: "pending@example.com", status: "pending" };
add(pending, "request own access", "create", "accessRequests/pending", null, ownRequest, true);
add(pending, "cannot submit approved request", "create", "accessRequests/pending", null, { ...ownRequest, status: "approved" }, false);
add(pending, "cannot impersonate request", "create", "accessRequests/another-user", null, ownRequest, false);
add(pending, "read own status", "get", "accessControl/pending", null, null, true);

let passed = 0;
for (let offset = 0; offset < cases.length; offset += 50) {
  const batch = cases.slice(offset, offset + 50);
  const response = await fetch("https://firebaserules.googleapis.com/v1/projects/doc-flow-8a352:test", {
    method: "POST",
    headers: { Authorization: "Bearer " + token.access_token, "Content-Type": "application/json" },
    body: JSON.stringify({ source: { files: [{ name: "firestore.rules", content: rules }] }, testSuite: { testCases: batch } }),
  });
  const result = await response.json();
  if (!response.ok || result.issues?.some((i) => i.severity === "ERROR")) {
    throw new Error(JSON.stringify({ status: response.status, issues: result.issues, error: result.error }));
  }
  assert.equal(result.testResults?.length, batch.length, "All cases must be evaluated");
  result.testResults.forEach((test, i) => {
    if (test.state !== "SUCCESS") console.error(labels[offset + i], JSON.stringify(test));
    else passed++;
  });
}
console.log(passed + "/" + cases.length + " workspace rules tests passed (dry-run, mocked data)");
assert.equal(passed, cases.length);
