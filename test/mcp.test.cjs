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
    query: {},
    headers: {},
    body: "",
    auth: false,
    authConfig: { type: "none" },
    extract: {},
    responses: {},
  };
  return { ...structuredClone(baseline), description, baseline: structuredClone(baseline) };
}

function generatedUsers(description = "Spec docs") {
  const request = openApiRequest("Old docs");
  delete request.baseline;
  request.description = description;
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
  assert.ok(result.result.tools.some((tool) => tool.name === "get_collection_interceptors"));
  assert.ok(result.result.tools.some((tool) => tool.name === "set_collection_interceptors"));
  assert.ok(result.result.tools.some((tool) => tool.name === "review_openapi"));
  assert.ok(result.result.tools.some((tool) => tool.name === "apply_openapi_review"));
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
  assert.equal(state.collections[0].requests[0].description, "Spec docs");
  assert.equal(state.collections[0].syncUndo.requests[0].description, "Old docs");
  assert.match(state.collections[0].lastSync, /1 수정/);
});

test("apply_openapi_review requires an explicit resolution for selected conflicts", async () => {
  let state = openApiWorkspace("Local docs");
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
  assert.equal(review.changes[0].fields.find((field) => field.key === "description").conflict, true);

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
        resolutions: [{ requestId: "GET /users", field: "description", choice: "incoming" }],
      },
    },
  });
  assert.equal(applied.result.isError, undefined);
  assert.equal(state.collections[0].requests[0].description, "Spec docs");
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
