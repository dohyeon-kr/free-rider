const {
  app,
  autoUpdater,
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
const { serverUrl } = require("./modules/sync/server.cjs");
const {
  EnvironmentStore,
  shareableEnvironments,
} = require("./modules/env/index.cjs");
const { WorkspaceStore } = require("./modules/workspace/index.cjs");
const {
  effectiveRequest,
  assertions,
} = require("./modules/runner/context.cjs");
const { EnvironmentFiles } = require("./modules/env/files.cjs");
const { createUpdateController } = require("./modules/update/index.cjs");
const environmentFiles = new EnvironmentFiles();
const specFiles = new Set();
const { GitWorkspace } = require("./modules/git/index.cjs");
function shareCollection(value) {
  const {syncUndo, sourceFile, ...shared}=value;
  return {...shared,environments:shareableEnvironments(value.environments)};
}
let win,
  controller,
  workspace,
  updater,
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
async function chooseOpen(options) {
  if(process.argv.includes("--smoke-test")) {
    const fixture=require("./smoke.cjs").chooseFile(options);
    if(fixture)return {canceled:false,filePaths:[fixture]};
  }
  return dialog.showOpenDialog(win,options);
}
async function readChosen(filters) {
  const r = await chooseOpen({
    properties: ["openFile"],
    filters,
  });
  if (r.canceled) return null;
  const stat = await fs.stat(r.filePaths[0]);
  if (stat.size > 10 * 1024 * 1024) throw Error("파일은 10MB 이하여야 합니다.");
  return fs.readFile(r.filePaths[0], "utf8");
}
async function readSpecFile(filename) {
  if(!specFiles.has(filename)) throw Error("명세 파일을 먼저 연결하세요.");
  const stat=await fs.stat(filename);
  if(!stat.isFile() || stat.size>10*1024*1024) throw Error("명세는 10MB 이하 파일이어야 합니다.");
  const doc=parseSpec(await fs.readFile(filename,"utf8"));
  return {title:doc.info?.title || "API Collection",requests:operations(doc),baseUrl:serverUrl(doc.servers?.[0]),sourceFile:filename};
}
handle("import-spec", async () => {
  const result=await chooseOpen({properties:["openFile"],filters:[{name:"OpenAPI",extensions:["json","yaml","yml"]}]});
  if(result.canceled) return null;
  specFiles.add(result.filePaths[0]);return readSpecFile(result.filePaths[0]);
});
handle("sync-spec-file", filename => readSpecFile(filename));
handle("sync-spec", async (source, old) => {
  const r = await fetchText(source);
  if (r.status < 200 || r.status >= 300) throw Error(`명세 HTTP ${r.status}`);
  const doc = parseSpec(r.body);
  return {
    generated: operations(doc),
    title: doc.info?.title || "API Collection",
    baseUrl: serverUrl(doc.servers?.[0], source),
  };
});
handle("merge-spec", async (old, generated) => synchronize(old, generated));
handle("send", async (request, environment, collection, scripts) => {
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
    const r = await execute(context.request, vars, controller.signal, scripts, environment.values);
    runtime.remove(scope.id,r.deleted || []);
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
handle("env-connect", async () => {
  const result=await chooseOpen({properties:["openFile"],title:"환경 파일 연결"});
  if(result.canceled) return null;
  const filename=result.filePaths[0]; environmentFiles.allow(filename);
  const file=await environmentFiles.read(filename);
  return {...file,name:path.basename(filename),values:parseEnv(file.text)};
});
handle("env-read", async filename => {
  const file=await environmentFiles.read(filename);
  return {...file,values:parseEnv(file.text)};
});
handle("env-write", async (filename,text,revision) => {
  const file=await environmentFiles.save(filename,text,revision);
  return {...file,values:parseEnv(file.text)};
});
handle("env-parse", text => parseEnv(text));
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
    ![1,2].includes(value.version) ||
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
      shareCollection(value),
      null,
      2,
    ) + "\n",
  );
  return true;
});
handle("git-open", async (id) => {
  const r = await chooseOpen({ properties: ["openDirectory"] });
  return r.canceled ? null : gitFor(id).open(r.filePaths[0]);
});
handle("git-status", (id) => gitFor(id).status());
handle("git-save", (value) =>
  gitFor(value.id).save(shareCollection(value)),
);
handle("git-diff", (id) => gitFor(id).diff());
handle("git-commit", (id, message) => gitFor(id).commit(message));
handle("workspace-load", async () => {
  const value=await workspace.load() || (process.argv.includes("--smoke-test") ? require("./smoke.cjs").fixture() : null);
  for(const col of value?.collections || []) if(col.sourceFile) specFiles.add(col.sourceFile);
  for(const col of value?.collections || []) for(const env of col.environments || [])
    if(env.file?.path) environmentFiles.allow(env.file.path);
  return value;
});
handle("workspace-save", async (value) => {
  await workspace.save(value);
  dirty = false;
  win.setDocumentEdited(false);
  return true;
});
handle("set-dirty", (value) => {
  dirty = !!value;
  win.setDocumentEdited(dirty);
});
handle("copy", (text) => clipboard.writeText(String(text)));
handle("update-state", () => updater?.getState() || {
  enabled: false,
  state: "disabled",
  currentVersion: app.getVersion(),
  reason: "initializing",
});
handle("update-check", () => updater?.check());
handle("update-install", () => updater?.install());
function createWindow() {
  win = new BrowserWindow({
    show: !process.argv.includes("--smoke-test"),
    width: 1440,
    height: 940,
    minWidth: 950,
    minHeight: 650,
    backgroundColor: "#1b1b1b",
    titleBarStyle: "hiddenInset",
    title: "Free Rider",
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
  win.webContents.on("before-input-event", (event, input) => {
    const shortcut = input.key.toLowerCase();
    if (
      input.type === "keyDown" &&
      (input.meta || input.control) &&
      ["s", "n", "w", "k", "enter"].includes(shortcut)
    ) {
      event.preventDefault();
      win.webContents.send("ui-shortcut", shortcut);
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
  const smokeTest = process.argv.includes("--smoke-test");
  if (smokeTest)
    await require("./smoke.cjs").start();
  session.defaultSession.setPermissionRequestHandler((_w, _p, cb) => cb(false));
  workspace = new WorkspaceStore(
    smokeTest ? require("./smoke.cjs").workspacePath : path.join(app.getPath("userData"), "workspace.enc"),
    safeStorage,
  );
  createWindow();
  updater = createUpdateController({
    app,
    autoUpdater,
    getWindow: () => win,
    hasDirtyChanges: () => dirty,
    smokeTest,
  });
  updater.init();
  app.on("activate", () => {
    if (!BrowserWindow.getAllWindows().length) createWindow();
  });
});
app.on("window-all-closed", () => {
  runtime.clear();
  if (process.platform !== "darwin") app.quit();
});
