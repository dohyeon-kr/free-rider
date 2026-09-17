const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { app, BrowserWindow, ipcMain, net, shell } = require("electron");
const {
  createMcpServer,
  createLocalMcpHttpServer,
} = require("./modules/mcp/server.cjs");
const {
  loadAnnouncements,
  isAllowedAnnouncementUrl,
} = require("./modules/announcements.cjs");
const {
  loadScriptReference,
  SCRIPT_REFERENCE_PAGE,
} = require("./modules/docs-reference.cjs");
const { createRealtimeManager } = require("./modules/realtime/index.cjs");

const capturedHandlers = new Map();
const registerHandle = ipcMain.handle.bind(ipcMain);
const page = pathToFileURL(path.join(__dirname, "index.html")).href;

// main.cjs already owns the application data/session lifecycle. Capture its
// validated IPC handlers so MCP calls use exactly the same execution paths.
ipcMain.handle = (channel, listener) => {
  capturedHandlers.set(channel, listener);
  return registerHandle(channel, listener);
};
require("./main.cjs");
ipcMain.handle = registerHandle;

function appWindow() {
  const win = BrowserWindow.getAllWindows()[0];
  if (!win || win.isDestroyed()) throw Error("Free Rider window is not ready.");
  return win;
}

function rendererEvent() {
  const win = appWindow();
  return {
    sender: win.webContents,
    senderFrame: win.webContents.mainFrame,
  };
}

async function callApp(channel, ...args) {
  const handler = capturedHandlers.get(channel);
  if (!handler) throw Error(`Free Rider handler is unavailable: ${channel}`);
  return handler(rendererEvent(), ...args);
}

async function loadWorkspace() {
  return (await callApp("workspace-load")) || { collections: [] };
}

async function loadGeneratedSpec({ collection }) {
  if (collection.sourceFile) {
    const result = await callApp("sync-spec-file", collection.sourceFile);
    return {
      generated: result.requests || [],
      title: result.title || collection.title || "",
      baseUrl: result.baseUrl || "",
    };
  }
  if (String(collection.source || "").trim()) {
    return callApp("sync-spec", collection.source, collection.requests || [], undefined);
  }
  throw Error("Collection has no linked OpenAPI specification.");
}

async function saveWorkspace(state) {
  return callApp("workspace-save", state);
}

function hasUnsavedChanges() {
  return appWindow().isDocumentEdited?.() === true;
}

async function reloadWorkspace() {
  const win = appWindow();
  if (!win.isDestroyed()) win.webContents.reload();
}

async function saveCollectionInterceptors({ collectionId, interceptors }) {
  const win = appWindow();
  if (win.isDocumentEdited?.())
    throw Error("Save the Free Rider workspace before changing interceptors through MCP.");

  const state = await loadWorkspace();
  if (win.isDocumentEdited?.())
    throw Error("Save the Free Rider workspace before changing interceptors through MCP.");
  const collection = (state.collections || []).find((item) => item.id === collectionId);
  if (!collection) throw Error(`Collection not found: ${collectionId}`);

  collection.interceptors = structuredClone(interceptors);
  await callApp("workspace-save", state);

  // The renderer owns an in-memory workspace snapshot. Reload it only after a
  // successful persisted MCP write so the UI cannot later overwrite this change
  // with stale state. Unsaved renderer edits are rejected above.
  if (!win.isDestroyed()) win.webContents.reload();
  return collection.interceptors;
}

async function runSavedRequest({ collectionId, requestId, environmentId }) {
  const state = await loadWorkspace();
  const collection = (state.collections || []).find((item) => item.id === collectionId);
  if (!collection) throw Error(`Collection not found: ${collectionId}`);
  const request = (collection.requests || []).find((item) => item.id === requestId);
  if (!request) throw Error(`Request not found: ${requestId}`);

  const selectedId =
    environmentId ||
    state.selectedEnvironments?.[collection.id] ||
    collection.defaultEnvironment;
  const environment =
    (collection.environments || []).find((item) => item.id === selectedId) ||
    collection.environments?.[0];
  if (!environment) throw Error("This collection has no environment.");

  return callApp(
    "send",
    structuredClone(request),
    structuredClone(environment),
    structuredClone(collection),
    structuredClone(collection.interceptors || state.globalScripts || {}),
  );
}

const rpc = createMcpServer({
  name: "free-rider",
  version: app.getVersion(),
  loadWorkspace,
  runSavedRequest,
  loadNetworkHistory: () => callApp("network-history"),
  saveCollectionInterceptors,
  loadGeneratedSpec,
  saveWorkspace,
  hasUnsavedChanges,
  reloadWorkspace,
});
const mcp = createLocalMcpHttpServer(rpc);

function validateRenderer(event) {
  if (event.senderFrame?.url !== page) throw Error("Invalid sender");
}

registerHandle("mcp-state", async (event) => {
  validateRenderer(event);
  return mcp.status();
});
registerHandle("mcp-toggle", async (event, enabled) => {
  validateRenderer(event);
  return enabled ? mcp.start() : mcp.stop();
});

const ANNOUNCEMENT_CACHE_MS = 5 * 60 * 1000;
let announcementCache = { at: 0, items: [] };

registerHandle("announcement-list", async (event) => {
  validateRenderer(event);
  if (announcementCache.at && Date.now() - announcementCache.at < ANNOUNCEMENT_CACHE_MS)
    return announcementCache.items;
  const items = await loadAnnouncements((url, options) => net.fetch(url, options));
  announcementCache = { at: Date.now(), items };
  return items;
});

registerHandle("announcement-open", async (event, url) => {
  validateRenderer(event);
  if (!isAllowedAnnouncementUrl(url)) throw Error("허용되지 않은 공지 링크입니다.");
  await shell.openExternal(String(url));
  return true;
});

const DOC_REFERENCE_CACHE_MS = 5 * 60 * 1000;
let docReferenceCache = { at: 0, value: null };

registerHandle("docs-reference-get", async (event) => {
  validateRenderer(event);
  if (
    docReferenceCache.value &&
    Date.now() - docReferenceCache.at < DOC_REFERENCE_CACHE_MS
  )
    return docReferenceCache.value;
  const value = await loadScriptReference((url, options) => net.fetch(url, options));
  docReferenceCache = { at: Date.now(), value };
  return value;
});

registerHandle("docs-reference-open", async (event) => {
  validateRenderer(event);
  await shell.openExternal(SCRIPT_REFERENCE_PAGE);
  return true;
});

const realtime = createRealtimeManager({
  emit(value) {
    const win = BrowserWindow.getAllWindows()[0];
    if (win && !win.isDestroyed()) win.webContents.send("realtime-event", value);
  },
  fetcher(url, options) {
    return appWindow().webContents.session.fetch(url, {
      ...options,
      credentials: "include",
    });
  },
});

registerHandle("realtime-open", async (event, config) => {
  validateRenderer(event);
  return realtime.open(config);
});
registerHandle("realtime-send", async (event, id, data) => {
  validateRenderer(event);
  return realtime.send(id, data);
});
registerHandle("realtime-close", async (event, id) => {
  validateRenderer(event);
  return realtime.close(id);
});

app.on("before-quit", () => {
  realtime.closeAll();
  mcp.stop().catch((error) => console.error("MCP server shutdown failed", error));
});
