const { contextBridge, ipcRenderer } = require("electron");
const api = {};
for (const name of [
  "import-spec",
  "sync-spec",
  "sync-spec-file",
  "merge-spec",
  "send",
  "network-replay",
  "network-history",
  "network-clear",
  "cookie-jar",
  "cookie-clear",
  "cancel",
  "clear-tokens",
  "request-file-select",
  "request-file-status",
  "request-file-release",
  "import-env",
  "env-connect",
  "env-read",
  "env-write",
  "env-parse",
  "open-collection",
  "save-collection",
  "git-open",
  "git-create-parent",
  "git-create",
  "git-status",
  "git-save",
  "git-diff",
  "git-commit",
  "git-sync-commit",
  "workspace-load",
  "workspace-save",
  "set-dirty",
  "copy",
  "mcp-state",
  "mcp-toggle",
  "announcement-list",
  "announcement-open",
  "docs-reference-get",
  "docs-reference-open",
  "update-state",
  "update-check",
  "update-install",
])
  api[name] = (...args) => ipcRenderer.invoke(name, ...args);
api.onShortcut = (callback) => {
  const listener = (_event, key) => callback(key);
  ipcRenderer.on("ui-shortcut", listener);
  return () => ipcRenderer.removeListener("ui-shortcut", listener);
};
api.onUpdateStatus = (callback) => {
  const listener = (_event, value) => callback(value);
  ipcRenderer.on("update-status", listener);
  return () => ipcRenderer.removeListener("update-status", listener);
};
api.onNetworkEntry = (callback) => {
  const listener = (_event, value) => callback(value);
  ipcRenderer.on("network-entry", listener);
  return () => ipcRenderer.removeListener("network-entry", listener);
};
contextBridge.exposeInMainWorld("client", api);
