const { test } = require("node:test");
const assert = require("node:assert/strict");
const { operations, synchronize } = require("../src/modules/sync/index.cjs");
const { effectiveRequest } = require("../src/modules/runner/context.cjs");
const { prepare } = require("../src/modules/runner/request.cjs");

function spec(root = {}, operation = {}) {
  return {
    openapi: "3.1.0",
    info: { title: "Auth defaults", version: "1.0.0" },
    ...root,
    paths: {
      "/resource": {
        get: { tags: ["Account/Public"], responses: {}, ...operation },
      },
    },
  };
}

const protectedSecurity = [{ bearerAuth: [] }];
const publicCases = [
  ["no security declaration", {}, {}],
  ["empty root security", { security: [] }, {}],
  ["operation opts out of root security", { security: protectedSecurity }, { security: [] }],
  ["anonymous operation", { security: protectedSecurity }, { security: [{}] }],
  ["optional operation auth", {}, { security: [{}, ...protectedSecurity] }],
  ["optional operation auth in reverse order", {}, { security: [...protectedSecurity, {}] }],
  ["inherited anonymous security", { security: [{}] }, {}],
  ["inherited optional security", { security: [...protectedSecurity, {}] }, {}],
  ["unused security scheme definitions", {
    components: { securitySchemes: { bearerAuth: { type: "http", scheme: "bearer" } } },
  }, {}],
];

for (const [name, root, operation] of publicCases) {
  test(`OpenAPI imports ${name} as explicit No Auth`, () => {
    const [request] = operations(spec(root, operation));
    assert.equal(request.auth, false);
    assert.deepEqual(request.authConfig, { type: "none" });
  });
}

for (const [name, root, operation] of [
  ["inherited root security", { security: protectedSecurity }, {}],
  ["required operation security", {}, { security: protectedSecurity }],
  ["operation overriding anonymous root", { security: [{}] }, { security: protectedSecurity }],
  ["OR alternatives without anonymous access", {}, { security: [...protectedSecurity, { apiKey: [] }] }],
  ["AND schemes with empty scope arrays", {}, { security: [{ bearerAuth: [], apiKey: [] }] }],
]) {
  test(`OpenAPI keeps ${name} authenticated`, () => {
    const [request] = operations(spec(root, operation));
    assert.equal(request.auth, true);
    assert.equal(request.authConfig, undefined);
    const resolved = effectiveRequest({}, request).request;
    assert.deepEqual(resolved.authConfig, { type: "bearer", token: "{{token}}" });
    const prepared = prepare(resolved, { baseUrl: "https://example.com", token: "required-token" });
    assert.equal(prepared.headers.Authorization, "Bearer required-token");
    assert.throws(() => prepare(resolved, { baseUrl: "https://example.com" }), /token/);
  });
}

for (const [scope, collection] of [
  ["collection", { authConfig: { type: "bearer", token: "{{collectionToken}}" } }],
  ["nested folder", {
    authConfig: { type: "bearer", token: "{{collectionToken}}" },
    folders: [
      { path: "Account", authConfig: { type: "bearer", token: "{{folderToken}}" } },
      { path: "Account/Public", authConfig: { type: "basic", username: "{{username}}", password: "{{password}}" } },
    ],
  }],
]) {
  test(`public OpenAPI requests do not inherit ${scope} credentials`, () => {
    const [request] = operations(spec({ security: protectedSecurity }, { security: [] }));
    const resolved = effectiveRequest(collection, request).request;
    assert.deepEqual(resolved.authConfig, { type: "none" });
    const prepared = prepare(resolved, { baseUrl: "https://example.com" });
    assert.equal(prepared.headers.Authorization, undefined);
    assert.equal(prepare(request, { baseUrl: "https://example.com" }).headers.Authorization, undefined);
  });
}

test("sync upgrades legacy public requests to No Auth without repeated changes", () => {
  const generated = operations(spec());
  const legacy = structuredClone(generated[0]);
  delete legacy.authConfig;
  const previous = { ...legacy, baseline: structuredClone(legacy) };
  const synced = synchronize([previous], generated);
  assert.deepEqual(synced.requests[0].authConfig, { type: "none" });
  assert.deepEqual(synced.requests[0].baseline.authConfig, { type: "none" });
  assert.equal(synced.counts.updated, 1);
  assert.equal(synchronize(synced.requests, operations(spec())).counts.updated, 0);
});

test("sync changes unedited protected requests to No Auth when security is removed", () => {
  const first = synchronize([], operations(spec({ security: protectedSecurity }))).requests;
  const next = operations(spec({ security: protectedSecurity }, { security: [] }));
  const [request] = synchronize(first, next).requests;
  assert.equal(request.auth, false);
  assert.deepEqual(request.authConfig, { type: "none" });
});

test("sync removes generated No Auth when the operation becomes protected", () => {
  const first = synchronize([], operations(spec())).requests;
  const next = operations(spec({}, { security: protectedSecurity }));
  const [request] = synchronize(first, next).requests;
  assert.equal(request.auth, true);
  assert.equal(request.authConfig, undefined);
  assert.equal(effectiveRequest({}, request).request.authConfig.type, "bearer");
});

for (const authConfig of [
  { type: "inherit" },
  { type: "bearer", token: "{{customToken}}" },
  { type: "basic", username: "{{username}}", password: "{{password}}" },
]) {
  test(`sync preserves a manually selected ${authConfig.type} auth override`, () => {
    const first = synchronize([], operations(spec())).requests;
    first[0].authConfig = authConfig;
    const [request] = synchronize(first, operations(spec())).requests;
    assert.deepEqual(request.authConfig, authConfig);
    assert.deepEqual(request.baseline.authConfig, { type: "none" });
  });
}

test("sync preserves a manual No Auth override on a protected request", () => {
  const generated = operations(spec({ security: protectedSecurity }));
  const first = synchronize([], generated).requests;
  first[0].authConfig = { type: "none" };
  const [request] = synchronize(first, generated).requests;
  assert.deepEqual(effectiveRequest({}, request).request.authConfig, { type: "none" });
});
