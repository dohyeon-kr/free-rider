const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { app, BrowserWindow, ipcMain } = require("electron");
const {
  createMcpServer,
  createLocalMcpHttpServer,
} = require("./modules/mcp/server.cjs");

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

function rendererEvent() {
  const win = BrowserWindow.getAllWindows()[0];
  if (!win || win.isDestroyed()) throw Error("Free Rider window is not ready.");
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
    structuredClone(state.globalScripts || {}),
  );
}

const rpc = createMcpServer({
  name: "free-rider",
  version: app.getVersion(),
  loadWorkspace,
  runSavedRequest,
  loadNetworkHistory: () => callApp("network-history"),
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

app.on("before-quit", () => {
  mcp.stop().catch((error) => console.error("MCP server shutdown failed", error));
});
