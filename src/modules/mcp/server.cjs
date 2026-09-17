const http = require("node:http");

const MODERN_VERSION = "2026-07-28";
const LEGACY_VERSIONS = ["2025-11-25", "2025-06-18", "2025-03-26", "2024-11-05"];
const SERVER_INFO_META = "io.modelcontextprotocol/serverInfo";
const PROTOCOL_VERSION_META = "io.modelcontextprotocol/protocolVersion";
const DEFAULT_HOST = "127.0.0.1";
const DEFAULT_PORT = 48173;
const DEFAULT_PATH = "/mcp";
const MAX_BODY_BYTES = 1024 * 1024;

function jsonText(value) {
  return [{ type: "text", text: JSON.stringify(value, null, 2) }];
}

function requiredString(args, name) {
  const value = args?.[name];
  if (typeof value !== "string" || !value.trim())
    throw Error(`${name} must be a non-empty string.`);
  return value;
}

function optionalLimit(args, fallback = 20, maximum = 200) {
  if (args?.limit === undefined) return fallback;
  const value = Number(args.limit);
  if (!Number.isInteger(value) || value < 1 || value > maximum)
    throw Error(`limit must be an integer between 1 and ${maximum}.`);
  return value;
}

function toolDefinitions() {
  return [
    {
      name: "list_collections",
      description: "List Free Rider collections and their request/environment counts without exposing environment values.",
      inputSchema: { type: "object", properties: {}, additionalProperties: false },
    },
    {
      name: "list_requests",
      description: "List requests in a Free Rider collection.",
      inputSchema: {
        type: "object",
        properties: { collectionId: { type: "string" } },
        required: ["collectionId"],
        additionalProperties: false,
      },
    },
    {
      name: "get_request",
      description: "Read one saved Free Rider request, including URL, headers, body, auth, variables and assertions.",
      inputSchema: {
        type: "object",
        properties: {
          collectionId: { type: "string" },
          requestId: { type: "string" },
        },
        required: ["collectionId", "requestId"],
        additionalProperties: false,
      },
    },
    {
      name: "send_request",
      description: "Execute one saved Free Rider request with a saved environment and the workspace's global pre/post scripts.",
      inputSchema: {
        type: "object",
        properties: {
          collectionId: { type: "string" },
          requestId: { type: "string" },
          environmentId: { type: "string" },
        },
        required: ["collectionId", "requestId"],
        additionalProperties: false,
      },
    },
    {
      name: "list_network_history",
      description: "List recent Free Rider network history as compact summaries. Use get_network_entry for full details.",
      inputSchema: {
        type: "object",
        properties: { limit: { type: "integer", minimum: 1, maximum: 200 } },
        additionalProperties: false,
      },
    },
    {
      name: "get_network_entry",
      description: "Read one full Free Rider network-history entry by id.",
      inputSchema: {
        type: "object",
        properties: { id: { type: "string" } },
        required: ["id"],
        additionalProperties: false,
      },
    },
  ];
}

function createMcpServer(options) {
  const {
    name = "free-rider",
    version = "0.0.0",
    loadWorkspace,
    runSavedRequest,
    loadNetworkHistory,
  } = options;
  if (typeof loadWorkspace !== "function") throw Error("loadWorkspace is required.");
  if (typeof runSavedRequest !== "function") throw Error("runSavedRequest is required.");
  if (typeof loadNetworkHistory !== "function") throw Error("loadNetworkHistory is required.");

  const serverInfo = { name, version };
  const capabilities = { tools: {} };
  const instructions =
    "Free Rider exposes the currently open API workspace and recent network history. " +
    "Use list tools before selecting ids. Environment values are not returned by list tools.";

  function stamp(result, modern, cacheable = false) {
    if (!modern) return result;
    return {
      ...result,
      ...(cacheable ? { ttlMs: 0, cacheScope: "private" } : {}),
      resultType: "complete",
      _meta: {
        ...(result?._meta || {}),
        [SERVER_INFO_META]: serverInfo,
      },
    };
  }

  async function workspace() {
    const value = await loadWorkspace();
    return value && Array.isArray(value.collections) ? value : { collections: [] };
  }

  function collectionById(state, collectionId) {
    const collection = state.collections.find((item) => item.id === collectionId);
    if (!collection) throw Error(`Collection not found: ${collectionId}`);
    return collection;
  }

  function requestById(collection, requestId) {
    const request = (collection.requests || []).find((item) => item.id === requestId);
    if (!request) throw Error(`Request not found: ${requestId}`);
    return request;
  }

  async function callTool(name, args = {}) {
    if (name === "list_collections") {
      const state = await workspace();
      return state.collections.map((collection) => ({
        id: collection.id,
        title: collection.title,
        description: collection.description || "",
        requestCount: collection.requests?.length || 0,
        environments: (collection.environments || []).map((environment) => ({
          id: environment.id,
          name: environment.name,
        })),
      }));
    }

    if (name === "list_requests") {
      const state = await workspace();
      const collection = collectionById(state, requiredString(args, "collectionId"));
      return (collection.requests || []).map((request) => ({
        id: request.id,
        name: request.name,
        group: request.group || "",
        method: request.method,
        url: request.url,
      }));
    }

    if (name === "get_request") {
      const state = await workspace();
      const collection = collectionById(state, requiredString(args, "collectionId"));
      return requestById(collection, requiredString(args, "requestId"));
    }

    if (name === "send_request") {
      return runSavedRequest({
        collectionId: requiredString(args, "collectionId"),
        requestId: requiredString(args, "requestId"),
        environmentId:
          args.environmentId === undefined ? undefined : requiredString(args, "environmentId"),
      });
    }

    if (name === "list_network_history") {
      const limit = optionalLimit(args);
      const entries = await loadNetworkHistory();
      return entries.slice(0, limit).map((entry) => ({
        id: entry.id,
        at: entry.at,
        collectionId: entry.collectionId || "",
        collectionTitle: entry.collectionTitle || "",
        requestId: entry.requestId || "",
        name: entry.name || "",
        method: entry.request?.method || "",
        url: entry.request?.url || "",
        status: entry.response?.status || 0,
        elapsed: entry.response?.elapsed || entry.timing?.total || 0,
        error: entry.response?.error || "",
      }));
    }

    if (name === "get_network_entry") {
      const id = requiredString(args, "id");
      const entries = await loadNetworkHistory();
      const entry = entries.find((item) => item.id === id);
      if (!entry) throw Error(`Network entry not found: ${id}`);
      return entry;
    }

    throw Error(`Unknown tool: ${name}`);
  }

  async function handle(message, context = {}) {
    if (!message || message.jsonrpc !== "2.0" || typeof message.method !== "string") {
      return message?.id === undefined
        ? null
        : { jsonrpc: "2.0", id: message?.id ?? null, error: { code: -32600, message: "Invalid Request" } };
    }
    if (message.id === undefined) return null;

    const modern =
      context.protocolVersion === MODERN_VERSION ||
      message.params?._meta?.[PROTOCOL_VERSION_META] === MODERN_VERSION;

    try {
      if (message.method === "server/discover") {
        return {
          jsonrpc: "2.0",
          id: message.id,
          result: stamp(
            {
              supportedVersions: [MODERN_VERSION],
              capabilities,
              instructions,
            },
            true,
            true,
          ),
        };
      }

      if (message.method === "initialize") {
        const requested = message.params?.protocolVersion;
        const protocolVersion = LEGACY_VERSIONS.includes(requested)
          ? requested
          : LEGACY_VERSIONS[0];
        return {
          jsonrpc: "2.0",
          id: message.id,
          result: { protocolVersion, capabilities, serverInfo, instructions },
        };
      }

      if (message.method === "tools/list") {
        return {
          jsonrpc: "2.0",
          id: message.id,
          result: stamp({ tools: toolDefinitions() }, modern, true),
        };
      }

      if (message.method === "tools/call") {
        const toolName = requiredString(message.params, "name");
        try {
          const value = await callTool(toolName, message.params?.arguments || {});
          return {
            jsonrpc: "2.0",
            id: message.id,
            result: stamp({ content: jsonText(value) }, modern),
          };
        } catch (error) {
          return {
            jsonrpc: "2.0",
            id: message.id,
            result: stamp(
              {
                content: [{ type: "text", text: error?.message || String(error) }],
                isError: true,
              },
              modern,
            ),
          };
        }
      }

      if (message.method === "ping") {
        if (modern)
          return { jsonrpc: "2.0", id: message.id, error: { code: -32601, message: "Method not found" } };
        return { jsonrpc: "2.0", id: message.id, result: {} };
      }

      return { jsonrpc: "2.0", id: message.id, error: { code: -32601, message: "Method not found" } };
    } catch (error) {
      return {
        jsonrpc: "2.0",
        id: message.id,
        error: { code: -32602, message: error?.message || String(error) },
      };
    }
  }

  return { handle, tools: toolDefinitions() };
}

function errorResponse(id, code, message, data) {
  return {
    jsonrpc: "2.0",
    id: id ?? null,
    error: { code, message, ...(data === undefined ? {} : { data }) },
  };
}

function requestName(message) {
  if (message?.method === "tools/call" || message?.method === "prompts/get")
    return message.params?.name;
  if (message?.method === "resources/read") return message.params?.uri;
  return undefined;
}

function allowedOrigin(origin) {
  if (!origin) return true;
  try {
    const hostname = new URL(origin).hostname;
    return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
  } catch {
    return false;
  }
}

async function readJson(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) throw Object.assign(Error("Request body too large."), { statusCode: 413 });
    chunks.push(chunk);
  }
  if (!chunks.length) throw Object.assign(Error("Request body is required."), { statusCode: 400 });
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function validateProtocolRequest(req, message) {
  const headerVersion = req.headers["mcp-protocol-version"];
  const metaVersion = message?.params?._meta?.[PROTOCOL_VERSION_META];
  const known = new Set([MODERN_VERSION, ...LEGACY_VERSIONS]);

  for (const requested of [headerVersion, metaVersion]) {
    if (requested && !known.has(requested)) {
      return {
        status: 400,
        response: errorResponse(message?.id, -32022, "Unsupported protocol version", {
          supported: [MODERN_VERSION, ...LEGACY_VERSIONS],
          requested,
        }),
      };
    }
  }

  const modern = headerVersion === MODERN_VERSION || metaVersion === MODERN_VERSION;
  if (!modern) return { protocolVersion: headerVersion || metaVersion || "2025-03-26" };

  if (headerVersion !== MODERN_VERSION || metaVersion !== MODERN_VERSION) {
    return {
      status: 400,
      response: errorResponse(message?.id, -32020, "Header mismatch", {
        header: headerVersion || null,
        body: metaVersion || null,
      }),
    };
  }

  const methodHeader = req.headers["mcp-method"];
  if (methodHeader !== message?.method) {
    return {
      status: 400,
      response: errorResponse(message?.id, -32020, "Header mismatch", {
        header: methodHeader || null,
        body: message?.method || null,
      }),
    };
  }

  const expectedName = requestName(message);
  if (expectedName !== undefined && req.headers["mcp-name"] !== String(expectedName)) {
    return {
      status: 400,
      response: errorResponse(message?.id, -32020, "Header mismatch", {
        header: req.headers["mcp-name"] || null,
        body: expectedName,
      }),
    };
  }

  return { protocolVersion: MODERN_VERSION };
}

function createLocalMcpHttpServer(rpc, options = {}) {
  const host = options.host || DEFAULT_HOST;
  const port = options.port || DEFAULT_PORT;
  const endpointPath = options.path || DEFAULT_PATH;
  let server = null;

  function status() {
    const address = server?.address();
    return {
      enabled: !!server,
      host,
      port: typeof address === "object" && address ? address.port : port,
      url: server ? `http://${host}:${typeof address === "object" && address ? address.port : port}${endpointPath}` : "",
    };
  }

  async function start() {
    if (server) return status();
    server = http.createServer(async (req, res) => {
      const url = new URL(req.url || "/", `http://${req.headers.host || `${host}:${port}`}`);
      res.setHeader("Cache-Control", "no-store");
      res.setHeader("X-Content-Type-Options", "nosniff");

      if (url.pathname !== endpointPath) {
        res.writeHead(404).end();
        return;
      }
      if (!allowedOrigin(req.headers.origin)) {
        res.writeHead(403, { "Content-Type": "application/json" });
        res.end(JSON.stringify(errorResponse(null, -32600, "Forbidden origin")));
        return;
      }
      if (req.method === "GET") {
        res.writeHead(405, { Allow: "POST" }).end();
        return;
      }
      if (req.method !== "POST") {
        res.writeHead(405, { Allow: "POST" }).end();
        return;
      }
      if (!String(req.headers["content-type"] || "").toLowerCase().startsWith("application/json")) {
        res.writeHead(415).end();
        return;
      }

      let message;
      try {
        message = await readJson(req);
      } catch (error) {
        const statusCode = error.statusCode || (error instanceof SyntaxError ? 400 : 500);
        res.writeHead(statusCode, { "Content-Type": "application/json" });
        res.end(JSON.stringify(errorResponse(null, error instanceof SyntaxError ? -32700 : -32600, error.message)));
        return;
      }

      const validation = validateProtocolRequest(req, message);
      if (validation.response) {
        res.writeHead(validation.status, { "Content-Type": "application/json" });
        res.end(JSON.stringify(validation.response));
        return;
      }

      const response = await rpc.handle(message, { protocolVersion: validation.protocolVersion });
      if (!response) {
        res.writeHead(202).end();
        return;
      }

      let statusCode = 200;
      if (validation.protocolVersion === MODERN_VERSION && response.error?.code === -32601)
        statusCode = 404;
      res.writeHead(statusCode, {
        "Content-Type": "application/json",
        "MCP-Protocol-Version": validation.protocolVersion,
      });
      res.end(JSON.stringify(response));
    });

    await new Promise((resolve, reject) => {
      const onError = (error) => {
        server = null;
        reject(error);
      };
      server.once("error", onError);
      server.listen(port, host, () => {
        server.off("error", onError);
        resolve();
      });
    });
    return status();
  }

  async function stop() {
    if (!server) return status();
    const current = server;
    server = null;
    await new Promise((resolve, reject) => current.close((error) => (error ? reject(error) : resolve())));
    return status();
  }

  return { start, stop, status };
}

module.exports = {
  MODERN_VERSION,
  LEGACY_VERSIONS,
  DEFAULT_HOST,
  DEFAULT_PORT,
  DEFAULT_PATH,
  createMcpServer,
  createLocalMcpHttpServer,
  toolDefinitions,
  validateProtocolRequest,
};
