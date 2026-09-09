const { contextBridge, ipcRenderer } = require("electron");
const api = {};
for (const name of [
  "import-spec",
  "sync-spec",
  "merge-spec",
  "send",
  "cancel",
  "clear-tokens",
  "import-env",
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
])
  api[name] = (...args) => ipcRenderer.invoke(name, ...args);
api.onShortcut = (callback) => {
  const listener = (_event, key) => callback(key);
  ipcRenderer.on("ui-shortcut", listener);
  return () => ipcRenderer.removeListener("ui-shortcut", listener);
};
contextBridge.exposeInMainWorld("client", api);
