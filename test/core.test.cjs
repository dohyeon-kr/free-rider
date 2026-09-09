const { test } = require("node:test");
const assert = require("node:assert/strict");
const {
  parseSpec,
  operations,
  synchronize,
} = require("../src/modules/sync/index.cjs");
const { prepare, extract } = require("../src/modules/runner/request.cjs");
const { execute } = require("../src/modules/runner/index.cjs");
const {
  parseEnv,
  EnvironmentStore,
  shareableEnvironments,
} = require("../src/modules/env/index.cjs");
const http = require("node:http");
const doc = {
  openapi: "3.1.0",
  info: { title: "Demo" },
  paths: {
    "/users/{id}": {
      parameters: [{ name: "id", in: "path", schema: { type: "string" } }],
      get: {
        summary: "Get user",
        security: [{ bearer: [] }],
        parameters: [{ name: "limit", in: "query", schema: { default: 10 } }],
      },
    },
  },
};
test("OpenAPI generates runnable parameter templates and rejects unsupported specifications", () => {
  const [r] = operations(parseSpec(JSON.stringify(doc)));
  assert.equal(r.url, "{{baseUrl}}/users/{{id}}");
  assert.equal(r.query.limit, "10");
  assert.equal(r.auth, true);
  assert.throws(() => parseSpec('{"swagger":"2.0"}'));
});
test("sync updates generated defaults but preserves edits and removed operations", () => {
  const generated = operations(doc),
    first = synchronize([], generated).requests;
  first[0].query.limit = "25";
  const next = structuredClone(generated);
  next[0].name = "New summary";
  next[0].headers = { "X-New": "true" };
  const merged = synchronize(first, next);
  assert.equal(merged.requests[0].query.limit, "25");
  assert.equal(merged.requests[0].name, "New summary");
  assert.equal(merged.requests[0].headers["X-New"], "true");
  assert.equal(synchronize(merged.requests, []).requests[0].removed, true);
});
test("runner resolves variables and bearer token, encodes query and refuses missing values", () => {
  const r = operations(doc)[0];
  const p = prepare(r, {
    baseUrl: "https://example.com",
    id: "42",
    token: "abc",
  });
  assert.equal(p.url, "https://example.com/users/42?limit=10");
  assert.equal(p.headers.Authorization, "Bearer abc");
  assert.throws(() => prepare(r, {}), /환경변수/);
  assert.throws(() => prepare({ ...r, url: "file:///tmp/a" }, {}));
});
test("extract token and isolate environments; sharing strips values", () => {
  const values = extract('{"data":{"accessToken":"secret"}}', {
    token: "data.accessToken",
  });
  const store = new EnvironmentStore();
  store.capture("dev", values);
  assert.equal(store.resolve({ id: "dev", values: {} }).token, "secret");
  assert.equal(store.resolve({ id: "prod", values: {} }).token, undefined);
  assert.deepEqual(
    shareableEnvironments([{ id: "dev", values: { password: "secret" } }])[0]
      .values,
    { password: "" },
  );
  store.clear();
  assert.equal(store.resolve({ id: "dev", values: {} }).token, undefined);
});
test("dotenv import supports comments, export and quoted values", () => {
  assert.deepEqual(
    parseEnv('export A="value # kept"\nB=foo # comment\n# ignored\nC=one=two'),
    { A: "value # kept", B: "foo", C: "one=two" },
  );
});
test("HTTP runner handles login, authenticated follow-up, redirects and cancellation", async (t) => {
  const server = http.createServer((req, res) => {
    if (req.url === "/login") {
      res.setHeader("Content-Type", "application/json");
      res.end('{"token":"abc"}');
    } else if (req.url === "/redirect") {
      res.writeHead(302, { Location: "/login" });
      res.end();
    } else if (req.url === "/slow") {
      req.on("close", () => res.end());
    } else {
      res.end(JSON.stringify({ auth: req.headers.authorization }));
    }
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  t.after(() => server.close());
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  const login = await execute(
    { method: "POST", url: "{{baseUrl}}/login", extract: { token: "token" } },
    { baseUrl },
  );
  assert.equal(login.variables.token, "abc");
  const follow = await execute(
    { method: "GET", url: "{{baseUrl}}/me", auth: true },
    { baseUrl, ...login.variables },
  );
  assert.equal(JSON.parse(follow.body).auth, "Bearer abc");
  await assert.rejects(
    execute({ method: "GET", url: baseUrl + "/redirect" }, {}),
  );
  await assert.rejects(
    execute(
      { method: "GET", url: baseUrl + "/slow" },
      {},
      AbortSignal.timeout(50),
    ),
  );
});
