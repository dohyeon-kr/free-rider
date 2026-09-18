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
const { randomUUID } = require("node:crypto");
const { pathToFileURL } = require("node:url");
const { parseSpec, operations, synchronize, parseEnv } = require("./core.cjs");
const { execute, fetchText } = require("./network.cjs");
const { serverUrl } = require("./modules/sync/server.cjs");
const { readSpecSource } = require("./modules/sync/source.cjs");
const {
  EnvironmentStore,
  shareableEnvironments,
  mergeVariableScopes,
} = require("./modules/env/index.cjs");
const { WorkspaceStore } = require("./modules/workspace/index.cjs");
const {
  effectiveRequest,
  assertions,
  rows,
} = require("./modules/runner/context.cjs");
const { interpolate } = require("./modules/runner/request.cjs");
const { EnvironmentFiles } = require("./modules/env/files.cjs");
const { createUpdateController } = require("./modules/update/index.cjs");
const environmentFiles = new EnvironmentFiles();
const specFiles = new Set();
const requestFiles = new Map();
const MAX_REQUEST_FILE_BYTES = 25 * 1024 * 1024;
const NETWORK_HISTORY_LIMIT = 200;
const NETWORK_BODY_LIMIT = 512 * 1024;
const { GitWorkspace } = require("./modules/git/index.cjs");
function shareCollection(value) {
  const {syncUndo, sourceFile, ...shared}=value;
  return {...shared,environments:shareableEnvironments(value.environments)};
}
let win,
  controller,
  workspace,
  networkStore,
  apiSession,
  updater,
  dirty = false,
  networkEntries = [];
const runtime = new EnvironmentStore(),
  git = new Map(),
  replayRequests = new Map();
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
function requestFileId(value) {
  const id = String(value || "");
  if (!id || id.length > 240 || /[\u0000-\u001f]/.test(id))
    throw Error("올바르지 않은 파일 슬롯입니다.");
  return id;
}
function requestFileType(filename) {
  return ({
    ".json": "application/json",
    ".txt": "text/plain",
    ".csv": "text/csv",
    ".pdf": "application/pdf",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".gif": "image/gif",
    ".webp": "image/webp",
    ".svg": "image/svg+xml",
    ".zip": "application/zip",
  })[path.extname(filename).toLowerCase()] || "application/octet-stream";
}
async function resolveRequestFile(id, part = {}) {
  const key = requestFileId(id);
  const file = requestFiles.get(key);
  if (!file)
    throw Error(`${part.name || part.key || "업로드"} 파일을 다시 선택하세요.`);
  let stat;
  try {
    stat = await fs.stat(file.path);
  } catch {
    requestFiles.delete(key);
    throw Error(`${file.name} 파일을 다시 선택하세요.`);
  }
  if (!stat.isFile()) throw Error(`${file.name}은 파일이 아닙니다.`);
  if (stat.size > MAX_REQUEST_FILE_BYTES)
    throw Error("첨부 파일은 각각 25MB 이하여야 합니다.");
  return {
    data: await fs.readFile(file.path),
    name: file.name,
    type: file.type,
  };
}
function bodyForHistory(body) {
  if (body === undefined || body === null) return "";
  if (typeof body === "string")
    return body.length > NETWORK_BODY_LIMIT
      ? body.slice(0, NETWORK_BODY_LIMIT)
      : body;
  return body;
}
function responseForHistory(result) {
  const body = String(result.body || "");
  return {
    status: result.status || 0,
    statusText: result.statusText || "",
    headers: result.headers || {},
    body:
      body.length > NETWORK_BODY_LIMIT
        ? body.slice(0, NETWORK_BODY_LIMIT)
        : body,
    bodyTruncated: body.length > NETWORK_BODY_LIMIT,
    bytes: result.bytes || 0,
    elapsed: result.elapsed || 0,
    error: result.error || "",
  };
}
function persistNetworkHistory() {
  if (!networkStore) return;
  networkStore.save({ entries: networkEntries }).catch((error) =>
    console.error("network history save failed", error),
  );
}
function publishNetworkEntry(entry, replay = null) {
  networkEntries.unshift(entry);
  networkEntries = networkEntries.slice(0, NETWORK_HISTORY_LIMIT);
  if (replay) replayRequests.set(entry.id, replay);
  const keep = new Set(networkEntries.map((item) => item.id));
  for (const id of replayRequests.keys())
    if (!keep.has(id)) replayRequests.delete(id);
  persistNetworkHistory();
  if (win && !win.isDestroyed()) win.webContents.send("network-entry", entry);
}
async function runRequest(request, environment, collection, interceptors) {
  if (controller) throw Error("요청이 실행 중입니다.");
  controller = new AbortController();
  const startedAt = Date.now();
  let requestCookies = [];
  let preparedRequest = {
    url: request?.url || "",
    method: request?.method || "GET",
    headers: {},
    body: request?.body || "",
  };
  try {
    const context = effectiveRequest(collection || {}, request);
    const scope = {
      ...environment,
      values: mergeVariableScopes(context.vars, environment.values, context.scopedVars),
      id: (collection?.id || "default") + ":" + environment.id,
    };
    const vars = runtime.resolve(scope);
    const fetcher = async (url, options) => {
      requestCookies = await apiSession.cookies.get({ url });
      return apiSession.fetch(url, { ...options, credentials: "include" });
    };
    const r = await execute(
      context.request,
      vars,
      controller.signal,
      interceptors,
      environment.values,
      resolveRequestFile,
      fetcher,
    );
    preparedRequest = r.request || preparedRequest;
    runtime.remove(scope.id,r.deleted || []);
    runtime.capture(scope.id, r.variables);
    const result = {
      ...r,
      variables: Object.keys(r.variables),
      tests: assertions(r, request.assertions),
    };
    const currentCookies = await apiSession.cookies.get({ url: preparedRequest.url });
    const entry = {
      id: randomUUID(),
      at: startedAt,
      collectionId: collection?.id || "",
      collectionTitle: collection?.title || "",
      requestId: request?.id || "",
      name: request?.name || preparedRequest.url,
      replayable: true,
      request: {
        ...preparedRequest,
        body: bodyForHistory(preparedRequest.body),
      },
      response: responseForHistory(result),
      cookies: {
        request: requestCookies,
        current: currentCookies,
        setCookie: result.setCookies || [],
      },
      timing: result.timing || { waiting: 0, download: 0, total: result.elapsed || 0 },
    };
    publishNetworkEntry(entry, structuredClone({ request, environment, collection, interceptors }));
    return result;
  } catch (error) {
    const entry = {
      id: randomUUID(),
      at: startedAt,
      collectionId: collection?.id || "",
      collectionTitle: collection?.title || "",
      requestId: request?.id || "",
      name: request?.name || preparedRequest.url || "Request",
      replayable: true,
      request: {
        ...preparedRequest,
        body: bodyForHistory(preparedRequest.body),
      },
      response: {
        status: 0,
        statusText: "",
        headers: {},
        body: "",
        bodyTruncated: false,
        bytes: 0,
        elapsed: Date.now() - startedAt,
        error: error.message,
      },
      cookies: { request: requestCookies, current: [], setCookie: [] },
      timing: { waiting: 0, download: 0, total: Date.now() - startedAt },
    };
    publishNetworkEntry(entry, structuredClone({ request, environment, collection, interceptors }));
    throw error;
  } finally {
    controller = null;
  }
}
function prepareRealtimeRequest(request, environment, collection) {
  const context = effectiveRequest(collection || {}, request || {});
  const scope = {
    ...(environment || {}),
    values: mergeVariableScopes(
      context.vars,
      environment?.values || {},
      context.scopedVars,
    ),
    id: (collection?.id || "default") + ":" + (environment?.id || "default"),
  };
  const vars = runtime.resolve(scope);
  const url = new URL(interpolate(context.request.url || "", vars));
  for (const [key, value] of rows(context.request.query))
    if (value !== "") url.searchParams.append(key, interpolate(value, vars));
  const headers = Object.fromEntries(
    rows(context.request.headers).map(([key, value]) => [
      key,
      interpolate(value, vars),
    ]),
  );
  const auth = context.request.authConfig;
  if (auth?.type === "bearer")
    headers.Authorization =
      "Bearer " + interpolate(auth.token || "{{token}}", vars);
  if (auth?.type === "basic")
    headers.Authorization =
      "Basic " +
      Buffer.from(
        interpolate(auth.username || "", vars) +
          ":" +
          interpolate(auth.password || "", vars),
      ).toString("base64");
  return { url: url.toString(), headers };
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
handle("sync-spec", async (source, old, auth) => {
  const doc = parseSpec(await readSpecSource(source, auth, fetchText));
  return {
    generated: operations(doc),
    title: doc.info?.title || "API Collection",
    baseUrl: serverUrl(doc.servers?.[0], source),
  };
});
handle("merge-spec", async (old, generated) => synchronize(old, generated));
handle("send", (request, environment, collection, interceptors) =>
  runRequest(request, environment, collection, interceptors || collection?.interceptors || {}),
);
handle("realtime-prepare", (request, environment, collection) =>
  prepareRealtimeRequest(request, environment, collection),
);
handle("network-replay", async (id) => {
  const replay = replayRequests.get(String(id));
  if (!replay) throw Error("이 기록은 앱을 다시 연 뒤에는 재실행할 수 없습니다.");
  return runRequest(
    structuredClone(replay.request),
    structuredClone(replay.environment),
    structuredClone(replay.collection),
    structuredClone(replay.interceptors || replay.scripts || replay.collection?.interceptors || {}),
  );
});
handle("network-history", () => networkEntries);
handle("network-clear", async () => {
  networkEntries = [];
  replayRequests.clear();
  if (networkStore) await networkStore.save({ entries: [] });
  return true;
});
handle("cookie-jar", (url) =>
  apiSession.cookies.get(url ? { url: String(url) } : {}),
);
handle("cookie-clear", async () => {
  await apiSession.clearStorageData({ dataTypes: ["cookies"] });
  return true;
});
handle("cancel", () => controller?.abort());
handle("clear-tokens", () => {
  runtime.clear();
  return true;
});
handle("request-file-select", async (slot) => {
  const id = requestFileId(slot);
  const result = await chooseOpen({
    properties: ["openFile"],
    title: "요청에 첨부할 파일 선택",
  });
  if (result.canceled) return null;
  const filename = result.filePaths[0];
  const stat = await fs.stat(filename);
  if (!stat.isFile()) throw Error("파일을 선택하세요.");
  if (stat.size > MAX_REQUEST_FILE_BYTES)
    throw Error("첨부 파일은 각각 25MB 이하여야 합니다.");
  const file = {
    path: filename,
    name: path.basename(filename),
    size: stat.size,
    type: requestFileType(filename),
  };
  requestFiles.set(id, file);
  return { name: file.name, size: file.size, type: file.type };
});
handle("request-file-status", (slots) => {
  if (!Array.isArray(slots) || slots.length > 100)
    throw Error("파일 슬롯 목록이 올바르지 않습니다.");
  return Object.fromEntries(
    slots.map((slot) => {
      const id = requestFileId(slot);
      return [id, requestFiles.has(id)];
    }),
  );
});
handle("request-file-release", (slot) => requestFiles.delete(requestFileId(slot)));
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
require("./modules/git/create-ipc.cjs").registerGitCreation(handle, chooseOpen, gitFor);
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
require("./modules/git/sync-commit.cjs").registerGitSyncCommit(
  handle, id => git.get(id), shareCollection,
);
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
  apiSession = session.fromPartition(smokeTest ? "free-rider-api-smoke" : "persist:free-rider-api");
  workspace = new WorkspaceStore(
    smokeTest ? require("./smoke.cjs").workspacePath : path.join(app.getPath("userData"), "workspace.enc"),
    safeStorage,
  );
  networkStore = new WorkspaceStore(
    smokeTest
      ? require("./smoke.cjs").workspacePath + ".network"
      : path.join(app.getPath("userData"), "network-history.enc"),
    safeStorage,
  );
  try {
    const stored = await networkStore.load();
    networkEntries = (stored?.entries || [])
      .slice(0, NETWORK_HISTORY_LIMIT)
      .map((entry) => ({ ...entry, replayable: false }));
  } catch (error) {
    console.error("network history load failed", error);
    networkEntries = [];
  }
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
  requestFiles.clear();
  replayRequests.clear();
  if (process.platform !== "darwin") app.quit();
});
