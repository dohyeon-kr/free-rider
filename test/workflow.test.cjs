const { test } = require("node:test");
const assert = require("node:assert/strict");
const {
  effectiveRequest,
  assertions,
} = require("../src/modules/runner/context.cjs");
const { prepare } = require("../src/modules/runner/request.cjs");
test("collection/folder/request headers and auth inherit with explicit override", () => {
  const c = {
    headers: [{ key: "X-Mode", value: "collection" }],
    authConfig: { type: "bearer", token: "abc" },
    folders: [
      {
        path: "admin",
        headers: [{ key: "x-mode", value: "folder" }],
        authConfig: { type: "basic", username: "u", password: "p" },
      },
    ],
  };
  const r = {
    method: "GET",
    url: "https://example.com",
    group: "admin/users",
    headers: [{ key: "x-mode", value: "request" }],
    authConfig: { type: "inherit" },
  };
  let p = prepare(effectiveRequest(c, r).request, {});
  assert.equal(p.headers["x-mode"], "request");
  assert.equal(p.headers.Authorization, "Basic dTpw");
  r.authConfig = { type: "none" };
  assert.equal(
    prepare(effectiveRequest(c, r).request, {}).headers.Authorization,
    undefined,
  );
});
test("disabled and repeated query rows are respected", () => {
  const p = prepare(
    {
      method: "GET",
      url: "https://example.com",
      query: [
        { key: "tag", value: "a" },
        { key: "tag", value: "b" },
        { key: "secret", value: "no", enabled: false },
      ],
    },
    {},
  );
  assert.equal(p.url, "https://example.com/?tag=a&tag=b");
});
test("assertions evaluate response and clearly fail missing properties", () => {
  const res = {
    status: 200,
    elapsed: 12,
    body: '{"data":{"id":7}}',
    headers: { "content-type": "application/json" },
  };
  const results = assertions(res, [
    { expression: "res.status", operator: "equals", value: "200" },
    { expression: "res.body.data.id", operator: "equals", value: "7" },
    { expression: "res.body.missing", operator: "exists" },
    { expression: "res.responseTime", operator: "lessThan", value: "100" },
    {
      expression: "res.headers.content-type",
      operator: "contains",
      value: "json",
    },
  ]);
  assert.deepEqual(
    results.map((t) => t.passed),
    [true, true, false, true, true],
  );
});
test("encrypted workspace writes are serialized and round trip", async (t) => {
  const fs = require("node:fs/promises"),
    os = require("node:os"),
    path = require("node:path");
  const { WorkspaceStore } = require("../src/modules/workspace/index.cjs");
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "api-workspace-"));
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  const codec = {
    isEncryptionAvailable: () => true,
    encryptString: (s) => Buffer.from(s).reverse(),
    decryptString: (b) => Buffer.from(b).reverse().toString(),
  };
  const store = new WorkspaceStore(path.join(dir, "workspace.enc"), codec);
  assert.equal(await store.load(), null);
  await Promise.all([store.save({ id: 1 }), store.save({ id: 2 })]);
  assert.deepEqual(await store.load(), { id: 2, formatVersion: 2 });
  const old=codec.encryptString(JSON.stringify({collections:[],id:"legacy"}));
  await fs.writeFile(store.filename,old);
  assert.deepEqual(await store.load(),{collections:[],id:"legacy",formatVersion:2});
  assert.deepEqual(await fs.readFile(store.filename+".v1.bak"),old);
  const denied = new WorkspaceStore(path.join(dir, "denied.enc"), {
    isEncryptionAvailable: () => false,
  });
  await assert.rejects(denied.save({ secret: 1 }));
});
