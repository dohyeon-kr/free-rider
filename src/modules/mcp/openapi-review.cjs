const { randomUUID } = require("node:crypto");

const DEFAULT_REVIEW_TTL_MS = 10 * 60 * 1000;

function requiredString(args, name) {
  const value = args?.[name];
  if (typeof value !== "string" || !value.trim())
    throw Error(`${name} must be a non-empty string.`);
  return value.trim();
}

function openApiToolDefinitions() {
  return [
    {
      name: "get_openapi_spec",
      description:
        "Read the OpenAPI specification linked to a collection and list its generated operations without modifying the workspace.",
      inputSchema: {
        type: "object",
        properties: { collectionId: { type: "string" } },
        required: ["collectionId"],
        additionalProperties: false,
      },
    },
    {
      name: "set_openapi_source",
      description:
        "Validate and link an HTTP/HTTPS OpenAPI specification URL to a collection without applying endpoint changes. Free Rider must have no unsaved UI changes.",
      inputSchema: {
        type: "object",
        properties: {
          collectionId: { type: "string" },
          source: { type: "string" },
        },
        required: ["collectionId", "source"],
        additionalProperties: false,
      },
    },
    {
      name: "unlink_openapi",
      description:
        "Disconnect the linked OpenAPI specification from a collection without deleting saved requests. Free Rider must have no unsaved UI changes.",
      inputSchema: {
        type: "object",
        properties: { collectionId: { type: "string" } },
        required: ["collectionId"],
        additionalProperties: false,
      },
    },
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

function openApiConnection(collection = {}) {
  if (collection.sourceFile)
    return { linked: true, sourceType: "file", source: collection.sourceFile };
  if (String(collection.source || "").trim())
    return { linked: true, sourceType: "url", source: String(collection.source).trim() };
  return { linked: false, sourceType: "none", source: "" };
}

function generatedSpecSummary(collection, generated = {}) {
  const operations = (generated.generated || generated.requests || []).map(requestSummary);
  return {
    collectionId: collection.id,
    ...openApiConnection(collection),
    title: generated.title || collection.title || "",
    baseUrl: generated.baseUrl || "",
    operationCount: operations.length,
    operations,
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

function createOpenApiReviewTools(options = {}) {
  const {
    loadWorkspace,
    loadGeneratedSpec,
    saveWorkspace,
    hasUnsavedChanges = () => false,
    reloadWorkspace = async () => {},
    now = () => Date.now(),
    createReviewId = () => randomUUID(),
    reviewTtlMs = DEFAULT_REVIEW_TTL_MS,
  } = options;
  const reviews = new Map();
  const names = new Set(openApiToolDefinitions().map((tool) => tool.name));

  function requireBridge(name, value) {
    if (typeof value !== "function")
      throw Error(`OpenAPI MCP bridge is unavailable: ${name}.`);
    return value;
  }

  function ensureSavedWorkspace() {
    if (hasUnsavedChanges())
      throw Error(
        "Save the Free Rider workspace before changing OpenAPI settings or applying OpenAPI changes through MCP.",
      );
  }

  async function getOpenApiSpec(args) {
    const collectionId = requiredString(args, "collectionId");
    const state = await requireBridge("loadWorkspace", loadWorkspace)();
    const collection = collectionById(state, collectionId);
    if (!openApiConnection(collection).linked)
      return generatedSpecSummary(collection);
    const generated = await requireBridge("loadGeneratedSpec", loadGeneratedSpec)({
      collection: structuredClone(collection),
    });
    return generatedSpecSummary(collection, generated);
  }

  async function setOpenApiSource(args) {
    ensureSavedWorkspace();
    const collectionId = requiredString(args, "collectionId");
    const source = requiredString(args, "source");
    const state = await requireBridge("loadWorkspace", loadWorkspace)();
    ensureSavedWorkspace();
    const collection = collectionById(state, collectionId);
    const candidate = structuredClone(collection);
    candidate.source = source;
    delete candidate.sourceFile;
    const generated = await requireBridge("loadGeneratedSpec", loadGeneratedSpec)({
      collection: candidate,
    });

    const nextState = structuredClone(state);
    nextState.collections = nextState.collections.map((item) => {
      if (item.id !== collectionId) return item;
      const next = structuredClone(item);
      next.source = source;
      delete next.sourceFile;
      return next;
    });
    await requireBridge("saveWorkspace", saveWorkspace)(nextState);
    reviews.clear();
    await reloadWorkspace();
    return generatedSpecSummary(candidate, generated);
  }

  async function unlinkOpenApi(args) {
    ensureSavedWorkspace();
    const collectionId = requiredString(args, "collectionId");
    const state = await requireBridge("loadWorkspace", loadWorkspace)();
    ensureSavedWorkspace();
    const collection = collectionById(state, collectionId);
    if (!openApiConnection(collection).linked)
      return generatedSpecSummary(collection);

    const nextState = structuredClone(state);
    nextState.collections = nextState.collections.map((item) => {
      if (item.id !== collectionId) return item;
      const next = structuredClone(item);
      delete next.source;
      delete next.sourceFile;
      return next;
    });
    await requireBridge("saveWorkspace", saveWorkspace)(nextState);
    reviews.clear();
    await reloadWorkspace();
    return generatedSpecSummary(collectionById(nextState, collectionId));
  }

  function cleanExpiredReviews() {
    const time = now();
    for (const [id, review] of reviews)
      if (time - review.createdAt > reviewTtlMs) reviews.delete(id);
  }

  async function reviewOpenApi(args) {
    ensureSavedWorkspace();
    cleanExpiredReviews();
    const collectionId = requiredString(args, "collectionId");
    const state = await requireBridge("loadWorkspace", loadWorkspace)();
    ensureSavedWorkspace();
    const collection = collectionById(state, collectionId);
    const generated = await requireBridge("loadGeneratedSpec", loadGeneratedSpec)({
      collection: structuredClone(collection),
    });
    const { preview } = await import("../sync/review.mjs");
    const review = preview(collection.requests || [], generated.generated || []);
    const reviewId = createReviewId();
    reviews.set(reviewId, {
      collectionId,
      createdAt: now(),
      generated: structuredClone(generated),
      review,
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

  function selectedIdsFrom(args, review) {
    if (!Array.isArray(args?.selectedIds) || !args.selectedIds.length)
      throw Error("selectedIds must contain at least one request id.");
    if (args.selectedIds.some((id) => typeof id !== "string" || !id.trim()))
      throw Error("selectedIds must contain non-empty request ids.");
    const ids = [...new Set(args.selectedIds.map((id) => id.trim()))];
    const known = new Set((review.changes || []).map((change) => change.id));
    const unknown = ids.filter((id) => !known.has(id));
    if (unknown.length) throw Error(`Unknown review change id: ${unknown.join(", ")}`);
    return ids;
  }

  function conflictChoices(args, review, selectedIds) {
    if (args.resolutions !== undefined && !Array.isArray(args.resolutions))
      throw Error("resolutions must be an array.");
    const selected = new Set(selectedIds);
    const changes = new Map((review.changes || []).map((change) => [change.id, change]));
    const choices = {};
    for (const resolution of args.resolutions || []) {
      const requestId = requiredString(resolution, "requestId");
      const field = requiredString(resolution, "field");
      if (!selected.has(requestId))
        throw Error(`Resolution references an unselected request: ${requestId}`);
      if (!new Set(["local", "incoming"]).has(resolution.choice))
        throw Error("resolution choice must be local or incoming.");
      const conflict = (changes.get(requestId)?.fields || []).find(
        (item) => item.key === field && item.conflict,
      );
      if (!conflict)
        throw Error(`Conflict field not found for ${requestId}: ${field}`);
      choices[JSON.stringify([requestId, field])] = resolution.choice;
    }
    return choices;
  }

  async function applyOpenApiReview(args) {
    ensureSavedWorkspace();
    cleanExpiredReviews();
    const reviewId = requiredString(args, "reviewId");
    const stored = reviews.get(reviewId);
    if (!stored)
      throw Error("OpenAPI review not found or expired. Run review_openapi again.");
    const selectedIds = selectedIdsFrom(args, stored.review);
    const choices = conflictChoices(args, stored.review, selectedIds);

    const state = await requireBridge("loadWorkspace", loadWorkspace)();
    ensureSavedWorkspace();
    const collection = collectionById(state, stored.collectionId);
    const { applyReview } = await import("../sync/review.mjs");
    const requests = applyReview(collection.requests || [], stored.review, selectedIds, choices);
    const selected = new Set(selectedIds);
    const counts = { added: 0, updated: 0, removed: 0 };
    for (const change of stored.review.changes || [])
      if (selected.has(change.id) && Object.hasOwn(counts, change.type))
        counts[change.type] += 1;

    const next = structuredClone(collection);
    next.syncUndo = {
      requests: structuredClone(collection.requests || []),
      runPlan: structuredClone(collection.runPlan || []),
      title: collection.title,
      lastSync: collection.lastSync || "",
    };
    next.requests = requests;
    if (!(collection.requests || []).length && stored.generated.title)
      next.title = stored.generated.title;
    if (next.runPlan)
      next.runPlan = next.runPlan.filter((item) =>
        next.requests.some((request) => request.id === item.id),
      );
    next.lastSync =
      new Date(now()).toLocaleString() +
      ` · ${counts.added} 추가 · ${counts.updated} 수정 · ${counts.removed} 삭제`;

    const nextState = structuredClone(state);
    nextState.collections = nextState.collections.map((item) =>
      item.id === collection.id ? next : item,
    );
    await requireBridge("saveWorkspace", saveWorkspace)(nextState);
    reviews.delete(reviewId);
    await reloadWorkspace();

    const selectedEnvironmentId =
      nextState.selectedEnvironments?.[next.id] || next.defaultEnvironment;
    const environment =
      (next.environments || []).find((item) => item.id === selectedEnvironmentId) ||
      next.environments?.[0];
    const needsBaseUrl =
      !!stored.generated.baseUrl && !String(environment?.values?.baseUrl || "").trim();

    return {
      collectionId: next.id,
      applied: counts,
      selectedIds,
      lastSync: next.lastSync,
      ...(needsBaseUrl ? { suggestedBaseUrl: stored.generated.baseUrl } : {}),
    };
  }

  async function call(name, args = {}) {
    if (name === "get_openapi_spec") return getOpenApiSpec(args);
    if (name === "set_openapi_source") return setOpenApiSource(args);
    if (name === "unlink_openapi") return unlinkOpenApi(args);
    if (name === "review_openapi") return reviewOpenApi(args);
    if (name === "apply_openapi_review") return applyOpenApiReview(args);
    throw Error(`Unknown OpenAPI MCP tool: ${name}`);
  }

  return {
    has: (name) => names.has(name),
    call,
  };
}

module.exports = {
  DEFAULT_REVIEW_TTL_MS,
  openApiToolDefinitions,
  createOpenApiReviewTools,
};
