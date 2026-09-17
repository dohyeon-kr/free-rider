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

function server(overrides = {}) {
  return createMcpServer({
    version: "1.2.3",
    loadWorkspace: async () => fixture(),
    loadNetworkHistory: async () => [],
    runSavedRequest: async (value) => ({ status: 200, selected: value }),
    saveCollectionInterceptors: async ({ interceptors }) => interceptors,
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
