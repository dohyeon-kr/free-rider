const { randomUUID } = require("node:crypto");

const DEFAULT_REVIEW_TTL_MS = 10 * 60 * 1000;
const SERVER_INFO_META = "io.modelcontextprotocol/serverInfo";
const PROTOCOL_VERSION_META = "io.modelcontextprotocol/protocolVersion";

function requiredString(args, name) {
  const value = args?.[name];
  if (typeof value !== "string" || !value.trim())
    throw Error(`${name} must be a non-empty string.`);
  return value.trim();
}

function collectionById(state, collectionId) {
  const collection = (state?.collections || []).find((item) => item.id === collectionId);
  if (!collection) throw Error(`Collection not found: ${collectionId}`);
  return collection;
}

function requestSummary(request = {}) {
  return {
    id: request.id || "",
    name: request.name || "",
    method: request.method || "",
    url: request.url || "",
    group: request.group || "",
  };
}

function reviewSummary(review) {
  const summary = { added: 0, updated: 0, removed: 0, conflicts: 0 };
  for (const change of review.changes || []) {
    if (Object.hasOwn(summary, change.type)) summary[change.type] += 1;
    summary.conflicts += (change.fields || []).filter((field) => field.conflict).length;
  }
  return summary;
}

function serializeChanges(review) {
  return (review.changes || []).map((change) => ({
    id: change.id,
    type: change.type,
    request: requestSummary(change.incoming || change.local),
    fields: (change.fields || []).map((field) => ({
      key: field.key,
      path: field.path,
      before: field.before,
      local: field.local,
      incoming: field.incoming,
      conflict: field.conflict,
    })),
  }));
}

function toolDefinitions() {
  return [
    {
      name: "review_openapi",
      description:
        "Review changes between a collection's saved requests and its linked OpenAPI specification without modifying the workspace. Returns a short-lived reviewId for apply_openapi_review.",
      inputSchema: {
        type: "object",
        properties: { collectionId: { type: "string" } },
        required: ["collectionId"],
        additionalProperties: false,
      },
    },
    {
      name: "apply_openapi_review",
      description:
        "Apply explicitly selected changes from a prior review_openapi result. Conflicting fields require an explicit local/incoming resolution. Free Rider must have no unsaved UI changes.",
      inputSchema: {
        type: "object",
        properties: {
          reviewId: { type: "string" },
          selectedIds: {
            type: "array",
            items: { type: "string" },
            minItems: 1,
            uniqueItems: true,
          },
          resolutions: {
            type: "array",
            items: {
              type: "object",
              properties: {
                requestId: { type: "string" },
                field: { type: "string" },
                choice: { type: "string", enum: ["local", "incoming"] },
              },
              required: ["requestId", "field", "choice"],
              additionalProperties: false,
            },
          },
        },
        required: ["reviewId", "selectedIds"],
        additionalProperties: false,
      },
    },
  ];
}

function createOpenApiReviewTools(options) {
  const {
    loadWorkspace,
    loadGeneratedSpec,
    saveWorkspace,
    hasUnsavedChanges = () => false,
    reloadWorkspace = () => {},
    loadReviewModule = () => import("../sync/review.mjs"),
    now = () => Date.now(),
    createId = () => randomUUID(),
    reviewTtlMs = DEFAULT_REVIEW_TTL_MS,
  } = options || {};

  if (typeof loadWorkspace !== "function") throw Error("loadWorkspace is required.");
  if (typeof loadGeneratedSpec !== "function") throw Error("loadGeneratedSpec is required.");
  if (typeof saveWorkspace !== "function") throw Error("saveWorkspace is required.");

  const reviews = new Map();
  const tools = toolDefinitions();
  const names = new Set(tools.map((tool) => tool.name));

  function ensureSavedWorkspace() {
    if (hasUnsavedChanges())
      throw Error("Save the Free Rider workspace before reviewing or applying OpenAPI changes through MCP.");
  }

  function cleanExpiredReviews() {
    const time = now();
    for (const [id, entry] of reviews)
      if (time - entry.createdAt > reviewTtlMs) reviews.delete(id);
  }

  async function reviewOpenApi(args) {
    ensureSavedWorkspace();
    cleanExpiredReviews();
    const collectionId = requiredString(args, "collectionId");
    const state = await loadWorkspace();
    ensureSavedWorkspace();
    const collection = collectionById(state, collectionId);
    const generated = await loadGeneratedSpec({ collection: structuredClone(collection) });
    const { preview } = await loadReviewModule();
    const review = preview(collection.requests || [], generated.generated || []);
    const reviewId = createId();
    reviews.set(reviewId, {
      createdAt: now(),
      collectionId,
      review,
      generated: structuredClone(generated),
    });
    return {
      reviewId,
      expiresInMs: reviewTtlMs,
      collectionId,
      source: collection.sourceFile || collection.source || "",
      title: generated.title || collection.title || "",
      baseUrl: generated.baseUrl || "",
      summary: reviewSummary(review),
      changes: serializeChanges(review),
    };
  }

  async function applyOpenApiReview(args) {
    ensureSavedWorkspace();
    cleanExpiredReviews();
    const reviewId = requiredString(args, "reviewId");
    const entry = reviews.get(reviewId);
    if (!entry) throw Error("OpenAPI review not found or expired. Run review_openapi again.");
    if (!Array.isArray(args?.selectedIds) || !args.selectedIds.length)
      throw Error("selectedIds must contain at least one request id.");

    const selectedIds = [...new Set(args.selectedIds.map((value) => String(value)))];
    const changeIds = new Set((entry.review.changes || []).map((change) => change.id));
    const unknown = selectedIds.filter((id) => !changeIds.has(id));
    if (unknown.length) throw Error(`Unknown review change id: ${unknown.join(", ")}`);

    const choices = {};
    for (const resolution of args.resolutions || []) {
      const requestId = requiredString(resolution, "requestId");
      const field = requiredString(resolution, "field");
      if (!selectedIds.includes(requestId))
        throw Error(`Resolution references an unselected request: ${requestId}`);
      if (!['local', 'incoming'].includes(resolution.choice))
        throw Error("resolution choice must be local or incoming.");
      choices[JSON.stringify([requestId, field])] = resolution.choice;
    }

    const state = await loadWorkspace();
    ensureSavedWorkspace();
    const collection = collectionById(state, entry.collectionId);
    const { applyReview } = await loadReviewModule();
    const requests = applyReview(collection.requests || [], entry.review, selectedIds, choices);
    const selected = new Set(selectedIds);
    const counts = { added: 0, updated: 0, removed: 0 };
    for (const change of entry.review.changes || [])
      if (selected.has(change.id) && Object.hasOwn(counts, change.type)) counts[change.type] += 1;

    const next = structuredClone(collection);
    next.syncUndo = {
      requests: structuredClone(collection.requests || []),
      runPlan: structuredClone(collection.runPlan || []),
      title: collection.title,
      lastSync: collection.lastSync || "",
    };
    next.requests = requests;
    if (!(collection.requests || []).length && entry.generated.title)
      next.title = entry.generated.title;
    if (next.runPlan)
      next.runPlan = next.runPlan.filter((item) => next.requests.some((request) => request.id === item.id));
    next.lastSync =
      new Date(now()).toLocaleString() +
      ` · ${counts.added} 추가 · ${counts.updated} 수정 · ${counts.removed} 삭제`;

    const nextState = structuredClone(state);
    nextState.collections = nextState.collections.map((item) =>
      item.id === collection.id ? next : item,
    );
    await saveWorkspace(nextState);
    reviews.delete(reviewId);
    await reloadWorkspace();

    const selectedEnvironmentId =
      nextState.selectedEnvironments?.[next.id] || next.defaultEnvironment;
    const environment =
      (next.environments || []).find((item) => item.id === selectedEnvironmentId) ||
      next.environments?.[0];
    const needsBaseUrl =
      !!entry.generated.baseUrl && !String(environment?.values?.baseUrl || "").trim();

    return {
      collectionId: next.id,
      applied: counts,
      selectedIds,
      lastSync: next.lastSync,
      ...(needsBaseUrl ? { suggestedBaseUrl: entry.generated.baseUrl } : {}),
    };
  }

  async function call(name, args) {
    if (name === "review_openapi") return reviewOpenApi(args || {});
    if (name === "apply_openapi_review") return applyOpenApiReview(args || {});
    throw Error(`Unknown OpenAPI MCP tool: ${name}`);
  }

  return {
    tools,
    has: (name) => names.has(name),
    call,
  };
}

function extendMcpServer(base, extension, options = {}) {
  const serverInfo = options.serverInfo || { name: "free-rider", version: "0.0.0" };
  const modernVersion = options.modernVersion || "2026-07-28";

  function modern(message, context) {
    return (
      context?.protocolVersion === modernVersion ||
      message?.params?._meta?.[PROTOCOL_VERSION_META] === modernVersion
    );
  }

  function stamp(result, message, context) {
    if (!modern(message, context)) return result;
    return {
      ...result,
      resultType: "complete",
      _meta: {
        ...(result?._meta || {}),
        [SERVER_INFO_META]: serverInfo,
      },
    };
  }

  async function handle(message, context = {}) {
    if (message?.method === "tools/list") {
      const response = await base.handle(message, context);
      if (response?.result?.tools)
        response.result.tools = [...response.result.tools, ...extension.tools];
      return response;
    }

    if (message?.method === "tools/call" && extension.has(message.params?.name)) {
      if (message.id === undefined) return null;
      try {
        const value = await extension.call(message.params.name, message.params?.arguments || {});
        return {
          jsonrpc: "2.0",
          id: message.id,
          result: stamp(
            { content: [{ type: "text", text: JSON.stringify(value, null, 2) }] },
            message,
            context,
          ),
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
            message,
            context,
          ),
        };
      }
    }

    return base.handle(message, context);
  }

  return { handle, tools: [...(base.tools || []), ...extension.tools] };
}

module.exports = {
  DEFAULT_REVIEW_TTL_MS,
  toolDefinitions,
  createOpenApiReviewTools,
  extendMcpServer,
};
