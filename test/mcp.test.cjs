const test = require("node:test");
const assert = require("node:assert/strict");
const {
  MODERN_VERSION,
  createMcpServer,
  validateProtocolRequest,
} = require("../src/modules/mcp/server.cjs");

function fixture() {
  return {
    collections: [
      {
        id: "collection-1",
        title: "Example",
        description: "Example API",
        interceptors: {
          enabled: true,
          before: 'req.headers.set("X-Test", "1")',
          after: 'ctx.log("done")',
        },
        requests: [
          { id: "request-1", name: "Users", method: "GET", url: "{{baseUrl}}/users" },
        ],
        environments: [
          { id: "env-1", name: "Local", values: { baseUrl: "http://localhost:3000", token: "secret" } },
        ],
        rides: [
          {
            id: "course-1",
            name: "Smoke course",
            stopOnFailure: true,
            steps: [{ id: "step-1", requestId: "request-1" }],
          },
        ],
      },
    ],
  };
}

function openApiRequest(description = "Old docs") {
  const baseline = {
    id: "GET /users",
    name: "List users",
    group: "Users",
    description: "Old docs",
    method: "GET",
    url: "{{baseUrl}}/users",
    query: { page: "1" },
    headers: {},
    body: "",
    auth: false,
    authConfig: { type: "none" },
    extract: {},
    responses: {},
    openapi: {
      path: "/users",
      method: "GET",
      parameters: [
        { name: "page", in: "query", required: false, schema: { type: "integer" } },
      ],
    },
  };
  return { ...structuredClone(baseline), description, baseline: structuredClone(baseline) };
}

function generatedUsers(description = "Spec docs") {
  const request = openApiRequest("Old docs");
  delete request.baseline;
  request.description = description;
  request.query.page = "sample";
  request.openapi.parameters[0].schema.type = "string";
  return request;
}

function openApiWorkspace(description = "Old docs") {
  return {
    selectedEnvironments: { "collection-1": "env-1" },
    collections: [
      {
        id: "collection-1",
        title: "Example",
        source: "https://api.example.com/openapi.json",
        requests: [openApiRequest(description)],
        runPlan: [{ id: "GET /users", enabled: true }],
        environments: [{ id: "env-1", name: "Local", values: {} }],
      },
    ],
  };
}

function server(overrides = {}) {
  return createMcpServer({
    version: "1.2.3",
    loadWorkspace: async () => fixture(),
    loadNetworkHistory: async () => [],
    runSavedRequest: async (value) => ({ status: 200, selected: value }),
    saveCollectionInterceptors: async ({ interceptors }) => interceptors,
    loadGeneratedSpec: async () => ({ generated: [], title: "Example", baseUrl: "" }),
    saveWorkspace: async () => true,
    hasUnsavedChanges: () => false,
    reloadWorkspace: async () => {},
    ...overrides,
  });
}

test("list_collections does not expose environment values or interceptor source", async () => {
  const result = await server().handle({
    jsonrpc: "2.0",
    id: 1,
    method: "tools/call",
    params: { name: "list_collections", arguments: {} },
  });
  const value = JSON.parse(result.result.content[0].text);
  assert.deepEqual(value[0].environments, [{ id: "env-1", name: "Local" }]);
  assert.equal(value[0].interceptorsEnabled, true);
  assert.equal(result.result.content[0].text.includes("secret"), false);
  assert.equal(result.result.content[0].text.includes("X-Test"), false);
});

test("modern tools/list is stamped and non-cacheable", async () => {
  const result = await server().handle(
    { jsonrpc: "2.0", id: 2, method: "tools/list", params: {} },
    { protocolVersion: MODERN_VERSION },
  );
  assert.equal(result.result.resultType, "complete");
  assert.equal(result.result.ttlMs, 0);
  assert.equal(result.result.cacheScope, "private");
  assert.equal(result.result._meta["io.modelcontextprotocol/serverInfo"].version, "1.2.3");
  assert.ok(result.result.tools.some((tool) => tool.name === "set_request"));
  assert.ok(result.result.tools.some((tool) => tool.name === "get_collection_interceptors"));
  assert.ok(result.result.tools.some((tool) => tool.name === "set_collection_interceptors"));
  assert.ok(result.result.tools.some((tool) => tool.name === "list_courses"));
  assert.ok(result.result.tools.some((tool) => tool.name === "get_course"));
  assert.ok(result.result.tools.some((tool) => tool.name === "set_course"));
  assert.ok(result.result.tools.some((tool) => tool.name === "delete_course"));
  assert.ok(result.result.tools.some((tool) => tool.name === "ride_course"));
  assert.ok(result.result.tools.some((tool) => tool.name === "get_openapi_spec"));
  assert.ok(result.result.tools.some((tool) => tool.name === "set_openapi_source"));
  assert.ok(result.result.tools.some((tool) => tool.name === "unlink_openapi"));
  assert.ok(result.result.tools.some((tool) => tool.name === "review_openapi"));
  assert.ok(result.result.tools.some((tool) => tool.name === "apply_openapi_review"));
});

test("set_request patches editable request fields, preserves identity/sync metadata and reloads", async () => {
  const state = fixture();
  Object.assign(state.collections[0].requests[0], {
    group: "Users",
    query: [{ key: "page", value: "1", enabled: true }],
    headers: [{ key: "Accept", value: "application/json", enabled: true }],
    vars: [{ key: "scope", value: "local", enabled: true }],
    body: "",
    bodyType: "json",
    authConfig: { type: "inherit", token: "{{token}}" },
    description: "Before",
    manual: false,
    openapi: { path: "/users", method: "GET" },
    baseline: { method: "GET", url: "{{baseUrl}}/users" },
  });

  let saved = null;
  let reloads = 0;
  const result = await server({
    loadWorkspace: async () => structuredClone(state),
    saveWorkspace: async (next) => {
      saved = structuredClone(next);
      return true;
    },
    reloadWorkspace: async () => {
      reloads += 1;
    },
  }).handle({
    jsonrpc: "2.0",
    id: 10,
    method: "tools/call",
    params: {
      name: "set_request",
      arguments: {
        collectionId: "collection-1",
        requestId: "request-1",
        name: "Create user",
        method: "post",
        url: "{{baseUrl}}/users",
        headers: [{ key: "Content-Type", value: "application/json", enabled: true }],
        body: "{\"name\":\"{{name}}\"}",
        authConfig: { type: "bearer" },
        description: "Updated by MCP",
      },
    },
  });

  const request = JSON.parse(result.result.content[0].text);
  assert.equal(request.id, "request-1");
  assert.equal(request.name, "Create user");
  assert.equal(request.method, "POST");
  assert.equal(request.description, "Updated by MCP");
  assert.equal(request.authConfig.type, "bearer");
  assert.equal(request.authConfig.token, "{{token}}");
  assert.deepEqual(request.openapi, { path: "/users", method: "GET" });
  assert.deepEqual(request.baseline, { method: "GET", url: "{{baseUrl}}/users" });
  assert.equal(request.manual, false);
  assert.equal(saved.collections[0].requests[0].name, "Create user");
  assert.equal(reloads, 1);
});

test("set_request rejects writes while the app has unsaved changes", async () => {
  const result = await server({
    hasUnsavedChanges: () => true,
  }).handle({
    jsonrpc: "2.0",
    id: 11,
    method: "tools/call",
    params: {
      name: "set_request",
      arguments: {
        collectionId: "collection-1",
        requestId: "request-1",
        url: "https://example.com/users",
      },
    },
  });

  assert.equal(result.result.isError, true);
  assert.match(result.result.content[0].text, /Save the Free Rider workspace/);
});

test("set_request requires an editable field and cannot rewrite request ids", async () => {
  const result = await server().handle({
    jsonrpc: "2.0",
    id: 12,
    method: "tools/call",
    params: {
      name: "set_request",
      arguments: {
        collectionId: "collection-1",
        requestId: "request-1",
        id: "replacement-id",
      },
    },
  });

  assert.equal(result.result.isError, true);
  assert.match(result.result.content[0].text, /At least one editable request field/);
});

test("get_collection_interceptors returns the saved collection scripts", async () => {
  const result = await server().handle({
    jsonrpc: "2.0",
    id: 3,
    method: "tools/call",
    params: {
      name: "get_collection_interceptors",
      arguments: { collectionId: "collection-1" },
    },
  });
  assert.deepEqual(JSON.parse(result.result.content[0].text), {
    enabled: true,
    before: 'req.headers.set("X-Test", "1")',
    after: 'ctx.log("done")',
  });
});

test("set_collection_interceptors patches omitted fields and delegates persistence", async () => {
  let received;
  const result = await server({
    saveCollectionInterceptors: async (value) => {
      received = value;
      return value.interceptors;
    },
  }).handle({
    jsonrpc: "2.0",
    id: 4,
    method: "tools/call",
    params: {
      name: "set_collection_interceptors",
      arguments: {
        collectionId: "collection-1",
        enabled: false,
        before: 'req.headers.set("X-Agent", "1")',
      },
    },
  });
  assert.deepEqual(received, {
    collectionId: "collection-1",
    interceptors: {
      enabled: false,
      before: 'req.headers.set("X-Agent", "1")',
      after: 'ctx.log("done")',
    },
  });
  assert.deepEqual(JSON.parse(result.result.content[0].text), received.interceptors);
});

test("set_collection_interceptors requires at least one interceptor field", async () => {
  const result = await server().handle({
    jsonrpc: "2.0",
    id: 5,
    method: "tools/call",
    params: {
      name: "set_collection_interceptors",
      arguments: { collectionId: "collection-1" },
    },
  });
  assert.equal(result.result.isError, true);
  assert.match(result.result.content[0].text, /At least one/);
});

test("send_request delegates ids to the app bridge", async () => {
  let received;
  const result = await server({
    runSavedRequest: async (value) => {
      received = value;
      return { status: 204 };
    },
  }).handle({
    jsonrpc: "2.0",
    id: 6,
    method: "tools/call",
    params: {
      name: "send_request",
      arguments: { collectionId: "collection-1", requestId: "request-1", environmentId: "env-1" },
    },
  });
  assert.deepEqual(received, {
    collectionId: "collection-1",
    requestId: "request-1",
    environmentId: "env-1",
  });
  assert.equal(JSON.parse(result.result.content[0].text).status, 204);
});

test("course tools expose the saved ordered sequence", async () => {
  const list = await server().handle({
    jsonrpc: "2.0",
    id: 20,
    method: "tools/call",
    params: { name: "list_courses", arguments: { collectionId: "collection-1" } },
  });
  assert.deepEqual(JSON.parse(list.result.content[0].text), [
    {
      id: "course-1",
      name: "Smoke course",
      stepCount: 1,
      stopOnFailure: true,
    },
  ]);

  const detail = await server().handle({
    jsonrpc: "2.0",
    id: 21,
    method: "tools/call",
    params: {
      name: "get_course",
      arguments: { collectionId: "collection-1", courseId: "course-1" },
    },
  });
  const course = JSON.parse(detail.result.content[0].text);
  assert.equal(course.name, "Smoke course");
  assert.deepEqual(course.steps.map((step) => step.requestId), ["request-1"]);
  assert.equal(course.steps[0].method, "GET");
});

test("set_course persists ordered request ids and allows duplicates", async () => {
  let saved = null;
  let reloads = 0;
  const result = await server({
    saveWorkspace: async (state) => {
      saved = structuredClone(state);
      return true;
    },
    reloadWorkspace: async () => {
      reloads += 1;
    },
  }).handle({
    jsonrpc: "2.0",
    id: 22,
    method: "tools/call",
    params: {
      name: "set_course",
      arguments: {
        collectionId: "collection-1",
        courseId: "course-1",
        name: "Login twice",
        requestIds: ["request-1", "request-1"],
        stopOnFailure: false,
      },
    },
  });

  const course = JSON.parse(result.result.content[0].text);
  assert.equal(course.name, "Login twice");
  assert.equal(course.stopOnFailure, false);
  assert.deepEqual(course.steps.map((step) => step.requestId), ["request-1", "request-1"]);
  assert.deepEqual(
    saved.collections[0].rides[0].steps.map((step) => step.requestId),
    ["request-1", "request-1"],
  );
  assert.equal(saved.collections[0].activeRideId, "course-1");
  assert.equal(reloads, 1);
});

test("set_course rejects writes while the app has unsaved changes", async () => {
  const result = await server({
    hasUnsavedChanges: () => true,
  }).handle({
    jsonrpc: "2.0",
    id: 23,
    method: "tools/call",
    params: {
      name: "set_course",
      arguments: {
        collectionId: "collection-1",
        courseId: "course-1",
        requestIds: ["request-1"],
      },
    },
  });
  assert.equal(result.result.isError, true);
  assert.match(result.result.content[0].text, /Save the Free Rider workspace/);
});

test("ride_course executes every Course step through the saved request bridge", async () => {
  const calls = [];
  const result = await server({
    runSavedRequest: async (value) => {
      calls.push(value);
      return { status: 200, statusText: "OK", elapsed: 12 };
    },
  }).handle({
    jsonrpc: "2.0",
    id: 24,
    method: "tools/call",
    params: {
      name: "ride_course",
      arguments: {
        collectionId: "collection-1",
        courseId: "course-1",
        environmentId: "env-1",
      },
    },
  });

  const ride = JSON.parse(result.result.content[0].text);
  assert.equal(ride.state, "passed");
  assert.equal(ride.completed, 1);
  assert.equal(ride.failed, 0);
  assert.equal(ride.steps[0].passed, true);
  assert.deepEqual(calls, [
    {
      collectionId: "collection-1",
      requestId: "request-1",
      environmentId: "env-1",
    },
  ]);
});

test("ride_course honors stopOnFailure", async () => {
  const state = fixture();
  state.collections[0].rides[0].steps.push({ id: "step-2", requestId: "request-1" });
  const calls = [];
  const result = await server({
    loadWorkspace: async () => structuredClone(state),
    runSavedRequest: async (value) => {
      calls.push(value);
      return { status: 500, statusText: "Internal Server Error" };
    },
  }).handle({
    jsonrpc: "2.0",
    id: 25,
    method: "tools/call",
    params: {
      name: "ride_course",
      arguments: { collectionId: "collection-1", courseId: "course-1" },
    },
  });

  const ride = JSON.parse(result.result.content[0].text);
  assert.equal(ride.state, "failed");
  assert.equal(ride.completed, 1);
  assert.equal(ride.failed, 1);
  assert.equal(calls.length, 1);
});

test("get_openapi_spec reads the linked specification without saving", async () => {
  const state = openApiWorkspace();
  let saves = 0;
  const result = await server({
    loadWorkspace: async () => structuredClone(state),
    loadGeneratedSpec: async ({ collection }) => {
      assert.equal(collection.source, "https://api.example.com/openapi.json");
      return {
        generated: [generatedUsers()],
        title: "Example API",
        baseUrl: "https://api.example.com",
      };
    },
    saveWorkspace: async () => { saves += 1; },
  }).handle({
    jsonrpc: "2.0",
    id: 30,
    method: "tools/call",
    params: { name: "get_openapi_spec", arguments: { collectionId: "collection-1" } },
  });

  const value = JSON.parse(result.result.content[0].text);
  assert.equal(value.linked, true);
  assert.equal(value.sourceType, "url");
  assert.equal(value.source, "https://api.example.com/openapi.json");
  assert.equal(value.title, "Example API");
  assert.equal(value.operationCount, 1);
  assert.deepEqual(value.operations[0], {
    id: "GET /users",
    name: "List users",
    method: "GET",
    url: "{{baseUrl}}/users",
    group: "Users",
  });
  assert.equal(saves, 0);
});

test("set_openapi_source validates and links a URL without changing saved requests, then unlink_openapi disconnects it", async () => {
  let state = openApiWorkspace();
  const before = structuredClone(state.collections[0].requests);
  let reloads = 0;
  const rpc = server({
    loadWorkspace: async () => structuredClone(state),
    loadGeneratedSpec: async ({ collection }) => {
      assert.equal(collection.sourceFile, undefined);
      assert.equal(collection.source, "https://next.example.com/openapi.yaml");
      return {
        generated: [generatedUsers("Next docs")],
        title: "Next API",
        baseUrl: "https://next.example.com",
      };
    },
    saveWorkspace: async (next) => { state = structuredClone(next); },
    reloadWorkspace: async () => { reloads += 1; },
  });

  const linked = await rpc.handle({
    jsonrpc: "2.0",
    id: 31,
    method: "tools/call",
    params: {
      name: "set_openapi_source",
      arguments: {
        collectionId: "collection-1",
        source: " https://next.example.com/openapi.yaml ",
      },
    },
  });
  const linkedValue = JSON.parse(linked.result.content[0].text);
  assert.equal(linkedValue.source, "https://next.example.com/openapi.yaml");
  assert.equal(linkedValue.operationCount, 1);
  assert.equal(state.collections[0].source, "https://next.example.com/openapi.yaml");
  assert.deepEqual(state.collections[0].requests, before);
  assert.equal(reloads, 1);

  const unlinked = await rpc.handle({
    jsonrpc: "2.0",
    id: 32,
    method: "tools/call",
    params: { name: "unlink_openapi", arguments: { collectionId: "collection-1" } },
  });
  const unlinkedValue = JSON.parse(unlinked.result.content[0].text);
  assert.equal(unlinkedValue.linked, false);
  assert.equal(unlinkedValue.sourceType, "none");
  assert.equal(Object.hasOwn(state.collections[0], "source"), false);
  assert.deepEqual(state.collections[0].requests, before);
  assert.equal(reloads, 2);
});

test("network history can be filtered and summary URLs redact credential-like query parameters", async () => {
  const entries = [
    {
      id: "entry-1",
      at: 2000,
      collectionId: "collection-1",
      collectionTitle: "Example",
      requestId: "request-1",
      name: "Users",
      request: {
        method: "GET",
        url: "https://api.example.com/users?access_token=top-secret&cursor=2",
      },
      response: { status: 200, elapsed: 18, error: "" },
    },
    {
      id: "entry-2",
      at: 1000,
      collectionId: "collection-2",
      collectionTitle: "Other",
      requestId: "request-2",
      name: "Create",
      request: { method: "POST", url: "https://api.example.com/users" },
      response: { status: 500, elapsed: 25, error: "boom" },
    },
  ];
  const result = await server({
    loadNetworkHistory: async () => structuredClone(entries),
  }).handle({
    jsonrpc: "2.0",
    id: 33,
    method: "tools/call",
    params: {
      name: "list_network_history",
      arguments: {
        collectionId: "collection-1",
        method: "get",
        status: 200,
        since: 1500,
        search: "users",
      },
    },
  });

  const value = JSON.parse(result.result.content[0].text);
  assert.equal(value.length, 1);
  assert.equal(value[0].id, "entry-1");
  assert.equal(value[0].method, "GET");
  assert.equal(value[0].status, 200);
  assert.equal(value[0].url.includes("top-secret"), false);
  assert.equal(value[0].url.includes("cursor=2"), true);
});

test("get_network_entry redacts credential headers, cookies, query parameters and JSON credential fields", async () => {
  const entry = {
    id: "entry-secret",
    at: 2000,
    request: {
      method: "POST",
      url: "https://api.example.com/login?token=query-secret&safe=yes",
      headers: {
        Authorization: "Bearer header-secret",
        "X-Trace-Id": "trace-1",
        Cookie: "sid=cookie-secret",
      },
      body: JSON.stringify({
        username: "dohyeon",
        password: "body-secret",
        nested: { access_token: "nested-secret", safe: "kept" },
      }),
    },
    response: {
      status: 200,
      headers: {
        "Set-Cookie": "sid=response-cookie-secret",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ token: "response-token-secret", ok: true }),
    },
    cookies: {
      request: [{ name: "sid", value: "cookie-secret", domain: "api.example.com" }],
      current: [{ name: "sid", value: "current-cookie-secret", domain: "api.example.com" }],
      setCookie: ["sid=response-cookie-secret; HttpOnly"],
    },
    timing: { total: 10 },
  };
  const result = await server({
    loadNetworkHistory: async () => [structuredClone(entry)],
  }).handle({
    jsonrpc: "2.0",
    id: 34,
    method: "tools/call",
    params: { name: "get_network_entry", arguments: { id: "entry-secret" } },
  });

  const text = result.result.content[0].text;
  const value = JSON.parse(text);
  for (const secret of [
    "query-secret",
    "header-secret",
    "cookie-secret",
    "body-secret",
    "nested-secret",
    "response-cookie-secret",
    "response-token-secret",
    "current-cookie-secret",
  ])
    assert.equal(text.includes(secret), false, secret);
  assert.equal(value.request.headers.Authorization, "[REDACTED]");
  assert.equal(value.request.headers["X-Trace-Id"], "trace-1");
  assert.equal(value.cookies.request[0].value, "[REDACTED]");
  assert.equal(value.sensitiveFieldsRedacted, true);
  assert.match(value.request.body, /"username": "dohyeon"/);
  assert.match(value.request.body, /"password": "\[REDACTED\]"/);
  assert.match(value.response.body, /"ok": true/);
});

test("review_openapi returns a short-lived three-way diff without saving", async () => {
  const state = openApiWorkspace();
  let saves = 0;
  const rpc = server({
    loadWorkspace: async () => structuredClone(state),
    loadGeneratedSpec: async () => ({
      generated: [
        generatedUsers(),
        {
          id: "POST /users",
          name: "Create user",
          group: "Users",
          description: "",
          method: "POST",
          url: "{{baseUrl}}/users",
          query: {},
          headers: {},
          body: "{}",
          auth: false,
          authConfig: { type: "none" },
          extract: {},
          responses: {},
        },
      ],
      title: "Example API",
      baseUrl: "https://api.example.com",
    }),
    saveWorkspace: async () => { saves += 1; },
    createReviewId: () => "review-1",
    now: () => 1000,
  });

  const result = await rpc.handle({
    jsonrpc: "2.0",
    id: 10,
    method: "tools/call",
    params: { name: "review_openapi", arguments: { collectionId: "collection-1" } },
  });
  const value = JSON.parse(result.result.content[0].text);
  assert.equal(value.reviewId, "review-1");
  assert.equal(value.expiresInMs, 10 * 60 * 1000);
  assert.equal(value.source, "https://api.example.com/openapi.json");
  assert.equal(value.baseUrl, "https://api.example.com");
  assert.deepEqual(value.summary, { added: 1, updated: 1, removed: 0, conflicts: 0 });
  assert.deepEqual(value.changes.map((change) => [change.id, change.type]), [
    ["GET /users", "updated"],
    ["POST /users", "added"],
  ]);
  assert.equal(saves, 0);
});

test("apply_openapi_review persists only selected changes and suggests a missing baseUrl", async () => {
  let state = openApiWorkspace();
  let reloaded = 0;
  const rpc = server({
    loadWorkspace: async () => structuredClone(state),
    loadGeneratedSpec: async () => ({
      generated: [generatedUsers(), {
        id: "POST /users",
        name: "Create user",
        group: "Users",
        description: "",
        method: "POST",
        url: "{{baseUrl}}/users",
        query: {},
        headers: {},
        body: "{}",
        auth: false,
        authConfig: { type: "none" },
        extract: {},
        responses: {},
      }],
      title: "Example API",
      baseUrl: "https://api.example.com",
    }),
    saveWorkspace: async (next) => { state = structuredClone(next); },
    reloadWorkspace: async () => { reloaded += 1; },
    createReviewId: () => "review-2",
    now: () => 2000,
  });

  await rpc.handle({
    jsonrpc: "2.0",
    id: 11,
    method: "tools/call",
    params: { name: "review_openapi", arguments: { collectionId: "collection-1" } },
  });
  const result = await rpc.handle({
    jsonrpc: "2.0",
    id: 12,
    method: "tools/call",
    params: {
      name: "apply_openapi_review",
      arguments: { reviewId: "review-2", selectedIds: ["GET /users"] },
    },
  });
  const value = JSON.parse(result.result.content[0].text);
  assert.deepEqual(value.applied, { added: 0, updated: 1, removed: 0 });
  assert.equal(value.suggestedBaseUrl, "https://api.example.com");
  assert.equal(reloaded, 1);
  assert.equal(state.collections[0].requests.length, 1);
  assert.equal(state.collections[0].requests[0].description, "Old docs");
  assert.equal(state.collections[0].requests[0].query.page, "1");
  assert.equal(state.collections[0].requests[0].openapi.parameters[0].schema.type, "string");
  assert.equal(state.collections[0].syncUndo.requests[0].description, "Old docs");
  assert.match(state.collections[0].lastSync, /1 수정/);
});

test("apply_openapi_review requires an explicit resolution for selected conflicts", async () => {
  let state = openApiWorkspace("Local docs");
  state.collections[0].requests[0].openapi.parameters[0].schema.type = "boolean";
  let saves = 0;
  const rpc = server({
    loadWorkspace: async () => structuredClone(state),
    loadGeneratedSpec: async () => ({ generated: [generatedUsers()], title: "Example API", baseUrl: "" }),
    saveWorkspace: async (next) => { saves += 1; state = structuredClone(next); },
    createReviewId: () => "review-conflict",
  });

  const reviewResult = await rpc.handle({
    jsonrpc: "2.0",
    id: 13,
    method: "tools/call",
    params: { name: "review_openapi", arguments: { collectionId: "collection-1" } },
  });
  const review = JSON.parse(reviewResult.result.content[0].text);
  assert.equal(review.summary.conflicts, 1);
  assert.equal(review.changes[0].fields.find((field) => field.key === "openapi/parameters").conflict, true);

  const blocked = await rpc.handle({
    jsonrpc: "2.0",
    id: 14,
    method: "tools/call",
    params: {
      name: "apply_openapi_review",
      arguments: { reviewId: "review-conflict", selectedIds: ["GET /users"] },
    },
  });
  assert.equal(blocked.result.isError, true);
  assert.match(blocked.result.content[0].text, /충돌 처리 방식을 선택하세요/);
  assert.equal(saves, 0);

  const applied = await rpc.handle({
    jsonrpc: "2.0",
    id: 15,
    method: "tools/call",
    params: {
      name: "apply_openapi_review",
      arguments: {
        reviewId: "review-conflict",
        selectedIds: ["GET /users"],
        resolutions: [{ requestId: "GET /users", field: "openapi/parameters", choice: "incoming" }],
      },
    },
  });
  assert.equal(applied.result.isError, undefined);
  assert.equal(state.collections[0].requests[0].description, "Local docs");
  assert.equal(state.collections[0].requests[0].openapi.parameters[0].schema.type, "string");
  assert.equal(saves, 1);
});

test("OpenAPI MCP review refuses dirty workspaces and stale reviews", async () => {
  let state = openApiWorkspace();
  let dirty = true;
  const rpc = server({
    loadWorkspace: async () => structuredClone(state),
    loadGeneratedSpec: async () => ({ generated: [generatedUsers()], title: "Example API", baseUrl: "" }),
    saveWorkspace: async (next) => { state = structuredClone(next); },
    hasUnsavedChanges: () => dirty,
    createReviewId: () => "review-stale",
  });

  const dirtyResult = await rpc.handle({
    jsonrpc: "2.0",
    id: 16,
    method: "tools/call",
    params: { name: "review_openapi", arguments: { collectionId: "collection-1" } },
  });
  assert.equal(dirtyResult.result.isError, true);
  assert.match(dirtyResult.result.content[0].text, /Save the Free Rider workspace/);

  dirty = false;
  await rpc.handle({
    jsonrpc: "2.0",
    id: 17,
    method: "tools/call",
    params: { name: "review_openapi", arguments: { collectionId: "collection-1" } },
  });
  state.collections[0].requests[0].name = "Changed after review";

  const stale = await rpc.handle({
    jsonrpc: "2.0",
    id: 18,
    method: "tools/call",
    params: {
      name: "apply_openapi_review",
      arguments: { reviewId: "review-stale", selectedIds: ["GET /users"] },
    },
  });
  assert.equal(stale.result.isError, true);
  assert.match(stale.result.content[0].text, /검토 이후 요청이 변경되었습니다/);
});

test("modern HTTP validation requires matching protocol and method headers", () => {
  const message = {
    jsonrpc: "2.0",
    id: 7,
    method: "tools/list",
    params: {
      _meta: { "io.modelcontextprotocol/protocolVersion": MODERN_VERSION },
    },
  };
  assert.deepEqual(
    validateProtocolRequest(
      { headers: { "mcp-protocol-version": MODERN_VERSION, "mcp-method": "tools/list" } },
      message,
    ),
    { protocolVersion: MODERN_VERSION },
  );

  const mismatch = validateProtocolRequest(
    { headers: { "mcp-protocol-version": MODERN_VERSION, "mcp-method": "tools/call" } },
    message,
  );
  assert.equal(mismatch.status, 400);
  assert.equal(mismatch.response.error.code, -32020);
});

test("unsupported modern protocol version returns negotiation error", () => {
  const requested = "2027-01-01";
  const result = validateProtocolRequest(
    { headers: { "mcp-protocol-version": requested } },
    {
      jsonrpc: "2.0",
      id: 8,
      method: "server/discover",
      params: { _meta: { "io.modelcontextprotocol/protocolVersion": requested } },
    },
  );
  assert.equal(result.status, 400);
  assert.equal(result.response.error.code, -32022);
  assert.equal(result.response.error.data.requested, requested);
});

test("tool errors are returned as MCP tool errors", async () => {
  const result = await server().handle({
    jsonrpc: "2.0",
    id: 9,
    method: "tools/call",
    params: { name: "get_request", arguments: { collectionId: "missing", requestId: "request-1" } },
  });
  assert.equal(result.result.isError, true);
  assert.match(result.result.content[0].text, /Collection not found/);
});
