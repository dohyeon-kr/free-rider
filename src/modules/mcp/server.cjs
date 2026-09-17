const MODERN_VERSION = "2026-07-28";
const LEGACY_VERSIONS = ["2025-11-25", "2025-06-18", "2025-03-26", "2024-11-05"];
const SERVER_INFO_META = "io.modelcontextprotocol/serverInfo";
const PROTOCOL_VERSION_META = "io.modelcontextprotocol/protocolVersion";

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
      description: "Read one saved Free Rider request, including its URL, headers, body, auth, variables and assertions.",
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
      description: "Execute one saved Free Rider request with a saved environment. Uses the collection and global pre/post scripts stored in the workspace.",
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
      description: "List recent Free Rider network history as compact summaries. Use get_network_entry for full request/response details.",
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
    "Free Rider exposes saved API collections, requests and recent network history. " +
    "Use list tools before selecting ids. Environment values stay local unless a request execution needs them.";

  function protocolVersion(message) {
    return message?.params?._meta?.[PROTOCOL_VERSION_META];
  }

  function isModern(message) {
    const meta = message?.params?._meta;
    return message?.method === "server/discover" ||
      !!(meta && Object.hasOwn(meta, PROTOCOL_VERSION_META));
  }

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

  async function handle(message) {
    if (!message || message.jsonrpc !== "2.0" || typeof message.method !== "string") {
      return message?.id === undefined
        ? null
        : { jsonrpc: "2.0", id: message?.id ?? null, error: { code: -32600, message: "Invalid Request" } };
    }

    if (message.id === undefined) return null;
    const modern = isModern(message);

    try {
      const requestedModernVersion = protocolVersion(message);
      if (modern && requestedModernVersion && requestedModernVersion !== MODERN_VERSION) {
        return {
          jsonrpc: "2.0",
          id: message.id,
          error: {
            code: -32022,
            message: `Unsupported protocol version: ${requestedModernVersion}`,
            data: { supported: [MODERN_VERSION], requested: requestedModernVersion },
          },
        };
      }

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
          result: {
            protocolVersion,
            capabilities,
            serverInfo,
            instructions,
          },
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

function serveStdio(server, options = {}) {
  const input = options.input || process.stdin;
  const output = options.output || process.stdout;
  const log = options.log || ((...args) => console.error(...args));
  let buffer = "";
  let chain = Promise.resolve();

  function write(message) {
    if (!message) return;
    output.write(JSON.stringify(message) + "\n");
  }

  input.setEncoding?.("utf8");
  input.on("data", (chunk) => {
    buffer += chunk;
    let newline;
    while ((newline = buffer.indexOf("\n")) >= 0) {
      const line = buffer.slice(0, newline).trim();
      buffer = buffer.slice(newline + 1);
      if (!line) continue;
      chain = chain.then(async () => {
        let message;
        try {
          message = JSON.parse(line);
        } catch {
          write({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } });
          return;
        }
        try {
          write(await server.handle(message));
        } catch (error) {
          log("MCP request failed", error);
          if (message?.id !== undefined)
            write({ jsonrpc: "2.0", id: message.id, error: { code: -32603, message: "Internal error" } });
        }
      });
    }
  });
  input.on("error", (error) => log("MCP stdin error", error));
  return chain;
}

module.exports = {
  MODERN_VERSION,
  LEGACY_VERSIONS,
  createMcpServer,
  serveStdio,
  toolDefinitions,
};
