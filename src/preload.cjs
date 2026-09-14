const { contextBridge, ipcRenderer } = require("electron");
const api = {};
for (const name of [
  "import-spec",
  "sync-spec",
  "sync-spec-file",
  "merge-spec",
  "send",
  "cancel",
  "clear-tokens",
  "import-env",
  "env-connect",
  "env-read",
  "env-write",
  "env-parse",
  "open-collection",
  "save-collection",
  "git-open",
  "git-status",
  "git-save",
  "git-diff",
  "git-commit",
  "workspace-load",
  "workspace-save",
  "set-dirty",
  "copy",
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
contextBridge.exposeInMainWorld("client", api);
