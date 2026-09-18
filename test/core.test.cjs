const { test } = require("node:test");
const assert = require("node:assert/strict");
const {
  parseSpec,
  operations,
  synchronize,
} = require("../src/modules/sync/index.cjs");
const {
  prepare,
  extract,
  resolveRequestTarget,
} = require("../src/modules/runner/request.cjs");
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
  assert.equal(r.query.id, "");
  assert.equal(r.query.limit, "10");
  assert.equal(r.auth, true);
  assert.throws(() => parseSpec('{"swagger":"2.0"}'));
});
test("OpenAPI preserves request types, required fields and response schemas", () => {
  const schemaDoc = {
    openapi: "3.1.0",
    info: { title: "Schema Demo", version: "1.0.0" },
    components: {
      schemas: {
        User: {
          type: "object",
          required: ["id", "name"],
          properties: {
            id: { type: "string", format: "uuid" },
            name: { type: "string" },
          },
        },
      },
    },
    paths: {
      "/users/{id}": {
        post: {
          operationId: "updateUser",
          parameters: [
            {
              name: "id",
              in: "path",
              description: "User id",
              schema: { type: "string", format: "uuid" },
            },
            {
              name: "expand",
              in: "query",
              required: true,
              schema: { type: "boolean" },
            },
          ],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["name"],
                  properties: {
                    name: { type: "string" },
                    age: { type: "integer" },
                  },
                },
              },
            },
          },
          responses: {
            200: {
              description: "OK",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/User" },
                },
              },
            },
          },
        },
      },
    },
  };
  const [r] = operations(schemaDoc);
  assert.equal(r.openapi.source, "openapi");
  assert.equal(r.openapi.operationId, "updateUser");
  assert.equal(r.openapi.document.title, "Schema Demo");
  assert.equal(r.openapi.parameters[0].required, true);
  assert.equal(r.openapi.parameters[0].schema.format, "uuid");
  assert.equal(r.openapi.parameters[1].schema.type, "boolean");
  assert.equal(r.openapi.requestBody.required, true);
  assert.equal(r.openapi.requestBody.contentType, "application/json");
  assert.deepEqual(
    r.openapi.requestBody.content["application/json"].schema.required,
    ["name"],
  );
  const responseSchema = r.responses["200"].content["application/json"].schema;
  assert.deepEqual(responseSchema.required, ["id", "name"]);
  assert.equal(responseSchema.properties.id.format, "uuid");
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
test("runner resolves params before variables and does not duplicate path params into query", () => {
  const r = operations(doc)[0];
  const fallback = prepare(r, {
    baseUrl: "https://example.com",
    id: "environment-id",
    token: "abc",
  });
  assert.equal(fallback.url, "https://example.com/users/environment-id?limit=10");

  r.query.id = "42";
  const p = prepare(r, {
    baseUrl: "https://example.com",
    id: "environment-id",
    token: "abc",
  });
  assert.equal(p.url, "https://example.com/users/42?limit=10");
  assert.equal(p.headers.Authorization, "Bearer abc");
  assert.throws(() => prepare({ ...r, query: { ...r.query, id: "" } }, {}), /환경변수/);
  assert.throws(() => prepare({ ...r, url: "file:///tmp/a" }, {}));
});

test("request params feed URL, headers and body before lower variable scopes", () => {
  const request = {
    method: "POST",
    url: "{{baseUrl}}/v2/notices/{{noticeUuid}}",
    query: [
      { key: "noticeUuid", value: "0197f22a-20b2-4e24-ad70-bf452cf8d65f", enabled: true },
      { key: "preview", value: "{{mode}}", enabled: true },
    ],
    headers: [{ key: "X-Notice", value: "{{noticeUuid}}", enabled: true }],
    bodyType: "json",
    body: '{"id":"{{noticeUuid}}"}',
  };
  const p = prepare(request, {
    baseUrl: "https://example.com",
    noticeUuid: "environment-value",
    mode: "full",
  });
  assert.equal(
    p.url,
    "https://example.com/v2/notices/0197f22a-20b2-4e24-ad70-bf452cf8d65f?preview=full",
  );
  assert.equal(p.headers["X-Notice"], "0197f22a-20b2-4e24-ad70-bf452cf8d65f");
  assert.equal(p.body, '{"id":"0197f22a-20b2-4e24-ad70-bf452cf8d65f"}');
});

test("params can read same-name lower scope values without recursive shadowing", () => {
  const target = resolveRequestTarget(
    {
      method: "GET",
      url: "https://example.com/search",
      query: [{ key: "token", value: "{{token}}", enabled: true }],
    },
    { token: "secret" },
  );
  assert.deepEqual(target.parameters, [
    { key: "token", value: "secret", location: "query" },
  ]);
});

test("request target resolution is shared by realtime requests", () => {
  const target = resolveRequestTarget(
    {
      type: "websocket",
      url: "wss://example.com/rooms/{{roomId}}",
      query: [
        { key: "roomId", value: "alpha", enabled: true },
        { key: "token", value: "{{accessToken}}", enabled: true },
      ],
    },
    { roomId: "environment-room", accessToken: "secret" },
  );
  assert.equal(target.url, "wss://example.com/rooms/alpha");
  assert.deepEqual(
    target.parameters.map(({ key, value, location }) => ({ key, value, location })),
    [
      { key: "roomId", value: "alpha", location: "path" },
      { key: "token", value: "secret", location: "query" },
    ],
  );
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

test("sync preserves UI auth, variables and renamed folders", () => {
  const generated = operations(doc),
    first = synchronize([], generated).requests;
  first[0].authConfig = { type: "basic", username: "{{user}}" };
  first[0].vars = [{ key: "x", value: "1" }];
  first[0].group = "my/folder";
  const next = synchronize(first, generated).requests[0];
  assert.deepEqual(next.authConfig, first[0].authConfig);
  assert.deepEqual(next.vars, first[0].vars);
  assert.equal(next.group, "my/folder");
});
