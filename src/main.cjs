const {
  app,
  BrowserWindow,
  ipcMain,
  dialog,
  session,
  safeStorage,
  clipboard,
} = require("electron");
const fs = require("node:fs/promises");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { parseSpec, operations, synchronize, parseEnv } = require("./core.cjs");
const { execute, fetchText } = require("./network.cjs");
const {
  EnvironmentStore,
  shareableEnvironments,
} = require("./modules/env/index.cjs");
const { WorkspaceStore } = require("./modules/workspace/index.cjs");
const {
  effectiveRequest,
  assertions,
} = require("./modules/runner/context.cjs");
const { GitWorkspace } = require("./modules/git/index.cjs");
let win,
  controller,
  workspace,
  dirty = false;
const runtime = new EnvironmentStore(),
  git = new Map();
function gitFor(id) {
  if (!git.has(id)) git.set(id, new GitWorkspace());
  return git.get(id);
}
const page = pathToFileURL(path.join(__dirname, "index.html")).href;
function handle(name, fn) {
  ipcMain.handle(name, async (event, ...args) => {
    if (
      event.sender !== win.webContents ||
      event.senderFrame !== win.webContents.mainFrame ||
      event.senderFrame.url !== page
    )
      throw Error("Invalid sender");
    return fn(...args);
  });
}
async function readChosen(filters) {
  const r = await dialog.showOpenDialog(win, {
    properties: ["openFile"],
    filters,
  });
  if (r.canceled) return null;
  const stat = await fs.stat(r.filePaths[0]);
  if (stat.size > 10 * 1024 * 1024) throw Error("파일은 10MB 이하여야 합니다.");
  return fs.readFile(r.filePaths[0], "utf8");
}
handle("import-spec", async () => {
  const text = await readChosen([
    { name: "OpenAPI", extensions: ["json", "yaml", "yml"] },
  ]);
  if (!text) return null;
  const doc = parseSpec(text);
  return {
    title: doc.info?.title || "API Collection",
    requests: operations(doc),
    baseUrl: doc.servers?.[0]?.url || "",
    source: "",
  };
});
handle("sync-spec", async (source, old) => {
  const r = await fetchText(source);
  if (r.status < 200 || r.status >= 300) throw Error(`명세 HTTP ${r.status}`);
  const doc = parseSpec(r.body);
  return {
    ...synchronize(old, operations(doc)),
    title: doc.info?.title || "API Collection",
    baseUrl: doc.servers?.[0]?.url || "",
  };
});
handle("merge-spec", async (old, generated) => synchronize(old, generated));
handle("send", async (request, environment, collection) => {
  if (controller) throw Error("요청이 실행 중입니다.");
  controller = new AbortController();
  try {
    const context = effectiveRequest(collection || {}, request);
    const scope = {
      ...environment,
      values: { ...context.vars, ...environment.values, ...context.scopedVars },
      id: (collection?.id || "default") + ":" + environment.id,
    };
    const vars = runtime.resolve(scope);
    const r = await execute(context.request, vars, controller.signal);
    runtime.capture(scope.id, r.variables);
    return {
      ...r,
      variables: Object.keys(r.variables),
      tests: assertions(r, request.assertions),
    };
  } finally {
    controller = null;
  }
});
handle("cancel", () => controller?.abort());
handle("clear-tokens", () => {
  runtime.clear();
  return true;
});
handle("import-env", async () => {
  const text = await readChosen([
    { name: "Environment", extensions: ["env", "local", "txt", "*"] },
  ]);
  return text === null ? null : parseEnv(text);
});
handle("open-collection", async () => {
  const text = await readChosen([{ name: "Collection", extensions: ["json"] }]);
  if (!text) return null;
  const value = JSON.parse(text);
  if (
    value.version !== 1 ||
    !Array.isArray(value.requests) ||
    !Array.isArray(value.environments) ||
    !value.environments.length ||
    value.environments.some(
      (e) =>
        !e.id ||
        !e.values ||
        typeof e.values !== "object" ||
        Array.isArray(e.values),
    ) ||
    value.requests.some((r) => !r.id || !r.method || !r.url)
  )
    throw Error("올바른 Open API Client 컬렉션이 아닙니다.");
  return value;
});
handle("save-collection", async (value) => {
  const r = await dialog.showSaveDialog(win, {
    defaultPath: "collection.json",
    filters: [{ name: "Collection", extensions: ["json"] }],
  });
  if (r.canceled) return false;
  await fs.writeFile(
    r.filePath,
    JSON.stringify(
      { ...value, environments: shareableEnvironments(value.environments) },
      null,
      2,
    ) + "\n",
  );
  return true;
});
handle("git-open", async (id) => {
  const r = await dialog.showOpenDialog(win, { properties: ["openDirectory"] });
  return r.canceled ? null : gitFor(id).open(r.filePaths[0]);
});
handle("git-status", (id) => gitFor(id).status());
handle("git-save", (value) =>
  gitFor(value.id).save({
    ...value,
    environments: shareableEnvironments(value.environments),
  }),
);
handle("git-diff", (id) => gitFor(id).diff());
handle("git-commit", (id, message) => gitFor(id).commit(message));
handle("workspace-load", () =>
  process.argv.includes("--smoke-test")
    ? require("./smoke.cjs").fixture()
    : workspace.load(),
);
handle("workspace-save", async (value) => {
  if (!process.argv.includes("--smoke-test")) await workspace.save(value);
  dirty = false;
  return true;
});
handle("set-dirty", (value) => {
  dirty = !!value;
  win.setDocumentEdited(dirty);
});
handle("copy", (text) => clipboard.writeText(String(text)));
function createWindow() {
  win = new BrowserWindow({
    width: 1440,
    height: 940,
    minWidth: 950,
    minHeight: 650,
    backgroundColor: "#1b1b1b",
    titleBarStyle: "hiddenInset",
    title: "Open API Client",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  win.on("close", (event) => {
    if (dirty && !process.argv.includes("--smoke-test")) {
      const answer = dialog.showMessageBoxSync(win, {
        type: "question",
        buttons: ["Keep editing", "Discard changes"],
        defaultId: 0,
        cancelId: 0,
        message: "Unsaved workspace changes",
        detail: "Save the workspace before closing to keep your changes.",
      });
      if (answer === 0) event.preventDefault();
    }
  });
  win.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  win.webContents.on("will-navigate", (e) => e.preventDefault());
  win
    .loadFile(path.join(__dirname, "index.html"))
    .then(async () => {
      if (!process.argv.includes("--smoke-test")) return;
      try {
        const result = await require("./smoke.cjs").run(win);
        console.log(result);
        app.exit(0);
      } catch (error) {
        console.error(error);
        app.exit(1);
      }
    })
    .catch((error) => {
      console.error(error);
      if (process.argv.includes("--smoke-test")) app.exit(1);
    });
}
app.whenReady().then(async () => {
  if (process.argv.includes("--smoke-test"))
    await require("./smoke.cjs").start();
  session.defaultSession.setPermissionRequestHandler((_w, _p, cb) => cb(false));
  workspace = new WorkspaceStore(
    path.join(app.getPath("userData"), "workspace.enc"),
    safeStorage,
  );
  createWindow();
  app.on("activate", () => {
    if (!BrowserWindow.getAllWindows().length) createWindow();
  });
});
app.on("window-all-closed", () => {
  runtime.clear();
  if (process.platform !== "darwin") app.quit();
});
