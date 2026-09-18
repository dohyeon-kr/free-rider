import { createGitRepositoryDialog } from "./git-create.js";
import { hasSyncChanges, offerSyncCommit } from "./git-sync-commit.mjs";
import { methodPicker } from "./method-picker.js";
import { preview, applyReview } from "../modules/sync/review.mjs";
import { reviewView } from "./sync-review.js";
const syncReviews = new Map();
import { specAuthEditor } from "./spec-auth.js";
import { SpecAuthSession } from "./spec-auth-state.mjs";
const specAuths = new SpecAuthSession();
import { runPlan, addToRun, executionRequests } from "./run-plan.mjs";
import { RequestDrafts } from "./drafts.mjs";
const drafts = new RequestDrafts();
import { isCurl, parseCurl } from "../modules/curl/index.mjs";
import { $, el, button, input, select, textarea, field, table } from "./dom.js";
import {
  openApiBadge,
  parameterSchemaView,
  requestBodySchemaView,
  responseSchemaView,
} from "./openapi-schema.js";
import {
  collection,
  request,
  normalize,
  rowList,
  requestTypeLabel,
} from "./model.js";
const api = window.client;
let state = {
    collections: [collection("My API Collection")],
    activeCollection: null,
    tabs: [],
    activeTab: null,
    selectedEnvironments: {},
    layout: "vertical",
  },
  dirty = new Set(),
  collapsed = new Set(),
  responses = new Map(),
  executionLogs = new Map(),
  history = [],
  busy = false,
  stopRun = false,
  runnerResults = new Map(),
  gitInfo = new Map(),
  subtabs = new Map(),
  realtimeSessions = new Map(),
  realtimeById = new Map();
const key = (t) => `${t.cid}|${t.kind}|${t.id || ""}`;
const c = () =>
  state.collections.find((c) => c.id === state.activeCollection) ||
  state.collections[0];
const active = () => state.tabs.find((t) => key(t) === state.activeTab);
const env = (col) =>
  col.environments.find((e) => e.id === state.selectedEnvironments[col.id]) ||
  col.environments.find((e) => e.id === col.defaultEnvironment) ||
  col.environments[0];
function status(text) {
  $("status").textContent = text;
}
async function action(fn) {
  try {
    return await fn();
  } catch (e) {
    status(e.message);
    return null;
  }
}
function mark(col = c()) {
  dirty.add(col.id);
  api["set-dirty"](true).catch((e) => status(e.message));
  renderTabs();
}
function open(kind, id = null, col = c()) {
  state.activeCollection = col.id;
  const t = { cid: col.id, kind, id };
  if (!state.tabs.some((x) => key(x) === key(t))) state.tabs.push(t);
  state.activeTab = key(t);
  render();
}
function closeTab(t) {
  const col = state.collections.find(c => c.id === t.cid);
  const request = col?.requests.find(r => r.id === t.id);
  if (t.kind === "request" && request && drafts.changed(t.cid, request)) {
    modal("요청 변경 저장", el("div", {},
      el("p", { text: request.name + "의 변경 내용을 저장할까요?" }),
      button("버리고 닫기", () => {
        drafts.discard(t.cid, t.id);
        $("dialog").close();
        finishCloseTab(t);
      }, { id: "discardRequest", class: "danger" })
    ), async () => {
      await persist(t);
      drafts.discard(t.cid, t.id);
      finishCloseTab(t);
    }, "저장하고 닫기");
    return;
  }
  if (t.kind === "request") drafts.discard(t.cid, t.id);
  finishCloseTab(t);
}
function finishCloseTab(t) {
  const i = state.tabs.findIndex((x) => key(x) === key(t));
  state.tabs.splice(i, 1);
  if (state.activeTab === key(t)) {
    const next = state.tabs[Math.min(i, state.tabs.length - 1)];
    if (next) {
      state.activeTab = key(next);
      state.activeCollection = next.cid;
    } else {
      state.activeTab = null;
    }
  }
  render();
}
function modal(title, content, confirm, label = "Save") {
  const d = $("dialog");
  if (d.open) d.close();
  $("dialogTitle").textContent = title;
  $("dialogContent").replaceChildren(content);
  $("dialogConfirm").textContent = label;
  $("dialogConfirm").onclick = () =>
    action(async () => {
      if ((await confirm()) !== false) d.close();
    });
  d.showModal();
  setTimeout(() => d.querySelector("input")?.focus(), 0);
}
function askName(title, initial, fn) {
  let value = initial;
  modal(
    title,
    field(
      "Name",
      input(value, (v) => (value = v), { id: "dialogName", required: true }),
    ),
    () => {
      if (!value.trim()) {
        status("Enter a name.");
        return false;
      }
      return fn(value.trim());
    },
    initial ? "Save" : "Create",
  );
}
function newRequest(group = "") {
  const col = c();
  if (!col) {
    $("newCollection").click();
    return;
  }
  let name = "";
  let type = "http";
  const picker = el("div", { class: "request-type-picker" });
  const options = [
    ["http", "HTTP", "일반 REST / HTTP 요청"],
    ["sse", "SSE", "Server-Sent Events 스트림"],
    ["websocket", "WebSocket", "양방향 실시간 연결"],
  ];
  const draw = () => {
    picker.replaceChildren(
      ...options.map(([value, title, description]) =>
        el(
          "button",
          {
            type: "button",
            class: "request-type-option " + (type === value ? "active" : ""),
            "aria-pressed": String(type === value),
            onClick: () => {
              type = value;
              draw();
            },
          },
          el("strong", { text: title }),
          el("span", { text: description }),
        ),
      ),
    );
  };
  draw();
  modal(
    "새 요청",
    el(
      "div",
      { class: "new-request-form" },
      picker,
      field(
        "이름",
        input(name, (value) => (name = value), {
          id: "dialogName",
          required: true,
          placeholder: "Request name",
        }),
      ),
    ),
    () => {
      if (!name.trim()) {
        status("요청 이름을 입력하세요.");
        return false;
      }
      const r = request(group, type);
      r.name = name.trim();
      col.requests.push(r);
      mark(col);
      open("request", r.id, col);
    },
    "생성",
  );
}
function collectionMenu(col) {
  state.activeCollection = col.id;
  const actions = el(
    "div",
    { class: "actions" },
    button("New Request", () => {
      $("dialog").close();
      newRequest();
    }),
    button("New Folder", () => {
      $("dialog").close();
      newFolder(col);
    }),
    button("Rename", () => {
      askName("Rename Collection", col.title, (name) => {
        col.title = name;
        mark(col);
        render();
      });
    }),
    button("Interceptors", () => {
      $("dialog").close();
      open("scripts", null, col);
    }),
    button("OpenAPI", () => {
      $("dialog").close();
      open("spec", null, col);
    }),
    button("Run Collection", () => {
      $("dialog").close();
      open("runner", null, col);
    }),
    button("Export Collection", () => {
      $("dialog").close();
      exportCollection(col);
    }),
  );
  modal(col.title, actions, () => true, "Close");
}
function newFolder(col, parent = "") {
  askName("New Folder", "", (name) => {
    const path = parent ? parent + "/" + name : name;
    if (col.folders.some((f) => f.path === path))
      throw Error("Folder already exists.");
    col.folders.push({
      path,
      vars: [],
      headers: [],
      authConfig: { type: "inherit" },
    });
    mark(col);
    open("folder", path, col);
  });
}
function folderMenu(col, path) {
  modal(
    path,
    el(
      "div",
      { class: "actions" },
      button("New Request", () => {
        $("dialog").close();
        state.activeCollection = col.id;
        newRequest(path);
      }),
      button("New Folder", () => {
        $("dialog").close();
        newFolder(col, path);
      }),
      button("Folder Settings", () => {
        $("dialog").close();
        open("folder", path, col);
      }),
    ),
    () => true,
    "Close",
  );
}
function renderTree() {
  const root = $("tree"),
    search = $("search").value.toLowerCase();
  root.replaceChildren();
  for (const col of state.collections) {
    const match = (r) =>
      `${r.name} ${r.url} ${r.method || ""} ${r.type || "http"} ${r.group}`
        .toLowerCase()
        .includes(search);
    const matches = col.requests.filter(match);
    if (search && !matches.length && !col.title.toLowerCase().includes(search))
      continue;
    const shut = collapsed.has(col.id) && !search;
    const row = el("div", {
      class: "tree-row " + (col.id === c().id ? "selected" : ""),
    });
    row.append(
      button(
        shut ? "›" : "⌄",
        () => {
          collapsed.has(col.id)
            ? collapsed.delete(col.id)
            : collapsed.add(col.id);
          renderTree();
        },
        { class: "arrow" },
      ),
      button(col.title, () => open("overview", null, col), {
        class: "tree-label",
      }),
      button("⋯", () => collectionMenu(col), {
        class: "more",
        title: "Collection actions",
      }),
    );
    root.append(row);
    if (shut) continue;
    const tree = { children: new Map(), requests: [] };
    function folder(path) {
      let n = tree;
      for (const part of path.split("/").filter(Boolean)) {
        if (!n.children.has(part))
          n.children.set(part, { children: new Map(), requests: [] });
        n = n.children.get(part);
      }
      return n;
    }
    for (const f of col.folders) if (!search) folder(f.path);
    for (const r of matches) folder(r.group || "").requests.push(r);
    function draw(n, path = "", depth = 1) {
      for (const [name, child] of n.children) {
        const p = path ? path + "/" + name : name,
          id = col.id + ":" + p,
          closed = collapsed.has(id) && !search;
        const r = el("div", { class: "tree-row folder-row" });
        r.style.paddingLeft = depth * 14 + "px";
        r.append(
          button(
            closed ? "›" : "⌄",
            () => {
              collapsed.has(id) ? collapsed.delete(id) : collapsed.add(id);
              renderTree();
            },
            { class: "arrow" },
          ),
          button(
            name,
            () => {
              collapsed.has(id) ? collapsed.delete(id) : collapsed.add(id);
              renderTree();
            },
            { class: "tree-label" },
          ),
          button("⋯", () => folderMenu(col, p), {
            class: "more",
            title: "Folder actions",
          }),
        );
        root.append(r);
        if (!closed) draw(child, p, depth + 1);
      }
      for (const req of n.requests) {
        const r = el("div", {
          class:
            "tree-row " +
            (active()?.id === req.id && active()?.cid === col.id
              ? "selected"
              : ""),
        });
        r.style.paddingLeft = depth * 14 + 12 + "px";
        const b = button("", () => open("request", req.id, col), {
          class: "tree-label",
          title: req.url,
        });
        b.append(
          requestBadge(req),
          el("span", { text: req.name + (req.removed ? " ⚠" : "") }),
        );
        r.append(b);
        root.append(r);
      }
    }
    draw(tree);
  }
}
function requestBadge(r) {
  const type = r?.type || "http";
  const tone =
    type === "sse" ? "SSE" : type === "websocket" ? "WS" : r?.method || "GET";
  return el("span", {
    class: "method " + tone,
    text: requestTypeLabel(r || { type: "http", method: "HTTP" }),
  });
}

function tabTitle(t) {
  const col = state.collections.find((c) => c.id === t.cid);
  if (t.kind === "request") {
    const r = col.requests.find((r) => r.id === t.id);
    return r?.name || "Request";
  }
  return {
    overview: "⬡ Collection",
    environments: "▤ Environments",
    spec: "♧ API Specs",
    runner: "▷ Runner",
    git: "⑂ Git",
    scripts: "⚡ Interceptors",
    folder: "▱ " + t.id,
  }[t.kind];
}
function renderTabs() {
  const root = $("workTabs");
  root.replaceChildren();
  for (const t of state.tabs) {
    const col = state.collections.find((c) => c.id === t.cid);
    if (!col) continue;
    const tab = el("div", {
      class: "work-tab " + (key(t) === state.activeTab ? "active" : ""),
      role: "tab",
      tabIndex: 0,
      "aria-selected": key(t) === state.activeTab,
      onClick: () => {
        state.activeTab = key(t);
        state.activeCollection = t.cid;
        render();
      },
      onKeydown: (e) => {
        if (e.key === "Enter") {
          state.activeTab = key(t);
          state.activeCollection = t.cid;
          render();
        }
      },
    });
    if (t.kind === "request") {
      const r = col.requests.find((r) => r.id === t.id);
      tab.append(requestBadge(r));
    }
    tab.append(el("span", { class: "label", text: tabTitle(t) }));
    if (t.kind === "request" ? col.requests.some(r => r.id === t.id && drafts.changed(t.cid, r)) : dirty.has(t.cid))
      tab.append(
        el("span", {
          class: "dirty-dot",
          text: "●",
          title: "저장하지 않은 변경",
        }),
      );
    tab.append(
      button(
        "×",
        (e) => {
          e.stopPropagation();
          closeTab(t);
        },
        { class: "close", title: "Close tab" },
      ),
    );
    root.append(tab);
  }
  root.append(
    button("＋", () => c() ? newRequest() : $("newCollection").click(), {
      class: "new-request-tab",
      title: c() ? "새 요청" : "새 컬렉션",
      "aria-label": c() ? "새 요청 탭 추가" : "새 컬렉션 만들기",
    }),
  );
}
function render() {
    renderTree();
    renderTabs();
    const col = c();
    for (const id of [
      "collectionHome",
      "collectionSwitch",
      "newRequest",
      "envButton",
      "specButton",
      "gitButton",
      "runnerButton",
      "scriptsButton",
      "exportActiveCollection",
    ]) {
      const control = $(id);
      if (control) control.disabled = !col;
    }
    $("activeTitle").textContent = col?.title || "컬렉션 없음";
    const es = $("environmentSelect");
    if (!col) {
      es.replaceChildren();
      es.disabled = true;
      $("branchStatus").textContent = "";
      state.activeCollection = null;
      state.activeTab = null;
      $("view").replaceChildren(
        el(
          "div",
          { class: "view-inner" },
          el("h2", { text: "컬렉션이 없습니다" }),
          el("p", {
            class: "muted",
            text: "새 컬렉션을 만들거나 기존 컬렉션 파일을 가져오세요.",
          }),
          button("새 컬렉션 만들기", () => $("newCollection").click(), {
            class: "primary",
          }),
        ),
      );
      return;
    }
    es.disabled = false;
    es.replaceChildren(
      ...col.environments.map((e) => el("option", { value: e.id, text: e.name })),
    );
    es.value = env(col).id;
    $("branchStatus").textContent = gitInfo.get(col.id)?.branch || "";
    const t = active();
    if (!t) {
      $("view").replaceChildren(
        el(
          "div",
          { class: "view-inner" },
          el("h2", { text: "Your workspace" }),
          button("Open collection overview", () => open("overview")),
        ),
      );
      return;
    }
    const view = {
    overview: () => overview(col),
    request: () =>
      requestView(
        col,
        col.requests.find((r) => r.id === t.id),
      ),
    environments: () => environments(col),
    spec: () => specView(col),
    runner: () => runnerView(col),
    git: () => gitView(col),
    scripts: () => scriptsView(col),
    folder: () => folderView(col, t.id),
  }[t.kind];
  $("view").replaceChildren(view());
}
function tabs(names, selected, onSelect) {
  return el(
    "div",
    { class: "subtabs" },
    names.map(([id, label]) =>
      button(label, () => onSelect(id), {
        class: id === selected ? "active" : "",
        "data-tab": id,
      }),
    ),
  );
}
function overview(col) {
  const current = subtabs.get(col.id + "overview") || "overview";
  const root = el("div", { class: "view-inner", "data-view": "overview" });
  root.append(
    tabs(
      [
        ["overview", "Overview"],
        ["headers", "Headers"],
        ["vars", "Vars"],
        ["auth", "Auth"],
        ["presets", "Presets"],
      ],
      current,
      (id) => {
        subtabs.set(col.id + "overview", id);
        render();
      },
    ),
  );
  if (current === "headers" || current === "vars") {
    root.append(
      el("h2", {
        text:
          current === "headers" ? "Collection Headers" : "Collection Variables",
      }),
      el("p", {
        class: "muted",
        text: "Inherited by requests in this collection. Request values take precedence.",
      }),
      kv(col, current, col),
    );
    return root;
  }
  if (current === "auth") {
    root.append(
      el("h2", { text: "Collection Authentication" }),
      authEditor(col, col, false),
    );
    return root;
  }
  if (current === "presets") {
    root.append(
      el("h2", { text: "Collection Presets" }),
      field(
        "Default environment",
        select(
          col.defaultEnvironment || col.environments[0].id,
          col.environments.map((e) => [e.id, e.name]),
          (v) => {
            col.defaultEnvironment = v;
            mark(col);
          },
        ),
      ),
      el("p", {
        class: "muted",
        text: "Used when there is no recently selected environment.",
      }),
    );
    return root;
  }
  const left = el("div", {}, el("h1", { text: "⬡  " + col.title }));
  const items = [
    [
      "▱",
      "Location",
      gitInfo.get(col.id)?.root || "Local workspace",
      "Connect Git folder",
      () => open("git"),
    ],
    [
      "◇",
      "Version",
      dirty.has(col.id) ? "Unsaved changes" : "All changes saved",
      "Save workspace",
      save,
    ],
    [
      "◎",
      "Environments",
      col.environments.length +
        " collection environment" +
        (col.environments.length === 1 ? "" : "s"),
      "Configure environments",
      () => open("environments"),
    ],
    [
      "API",
      "Requests",
      col.requests.length + " requests in this collection",
      "Run collection",
      () => open("runner"),
    ],
    [
      "⑂",
      "Share",
      "Share requests and variable names with your team",
      "Export collection",
      () => exportCollection(col),
    ],
    [
      "⚡",
      "Interceptors",
      col.interceptors?.enabled
        ? "Enabled for this collection"
        : "Disabled",
      "Configure interceptors",
      () => open("scripts", null, col),
    ],
    [
      "♧",
      "OpenAPI",
      col.source || "No specification URL connected",
      "Import or synchronize",
      () => open("spec"),
    ],
  ];
  for (const [icon, title, desc, link, fn] of items)
    left.append(
      el(
        "div",
        { class: "overview-item" },
        el("div", { class: "overview-icon", text: icon }),
        el(
          "div",
          {},
          el("h3", { text: title }),
          el("p", { text: desc }),
          button(link, () => action(fn), { class: "text-button" }),
        ),
      ),
    );
  const docs = el(
    "div",
    { class: "documentation" },
    el("h2", { text: "▧  Documentation" }),
    el("p", {
      text:
        col.description ||
        "Keep the context of your API next to the requests your team uses every day.",
    }),
    el("h3", { text: "Overview" }),
    el("p", {
      text: "Organize related endpoints in folders, choose an environment, and send your first request.",
    }),
    el(
      "ul",
      {},
      [
        "Import an OpenAPI document from a file or URL.",
        "Set baseUrl and credentials in Environments.",
        "Use {{variables}} in URLs, headers, authentication and request bodies.",
      ].map((text) => el("li", { text })),
    ),
    el("h3", { text: "Authentication & workflows" }),
    el("p", {
      text: "Set shared authentication on the collection or folder. Requests can inherit it, override it, or use no authentication.",
    }),
    el(
      "ul",
      {},
      [
        "Extract response values in the request Vars tab.",
        "Run login before protected requests in Collection Runner.",
        "Inspect response assertions in the Tests tab.",
      ].map((text) => el("li", { text })),
    ),
    el("h3", { text: "Collaboration" }),
    el("p", {
      text: "OpenAPI sync keeps your edited request values. Export a collection or commit it from the Git tab to share changes.",
    }),
    button(
      "Edit documentation",
      () => {
        let value = col.description || "";
        modal(
          "Collection Documentation",
          textarea(value, (v) => (value = v), {
            class: "collection-description",
          }),
          () => {
            col.description = value;
            mark(col);
            render();
          },
        );
      },
      { class: "text-button" },
    ),
  );
  root.append(el("div", { class: "overview-grid" }, left, docs));
  return root;
}
const columns = [
  { key: "key", label: "Name" },
  { key: "value", label: "Value" },
];
function kv(target, prop, col) {
  const existingRows = rowList(target[prop]);
  return table(existingRows, columns, (rows) => {
    target[prop] = rows;
    mark(col);
  });
}
function authEditor(target, col, inherit = true) {
  const value = target.authConfig || {
    type: target.auth === true ? "bearer" : inherit ? "inherit" : "none",
    token: "{{token}}",
  };
  const wrap = el("div");
  const options = [
    ...(inherit ? [["inherit", "Inherit from parent"]] : []),
    ["none", "No Auth"],
    ["bearer", "Bearer Token"],
    ["basic", "Basic Auth"],
  ];
  wrap.append(
    field(
      "Auth Type",
      select(
        value.type,
        options,
        (v) => {
          target.authConfig = { ...value, type: v };
          mark(col);
          render();
        },
        { id: "authType" },
      ),
    ),
  );
  function authField(label, key, placeholder, type = "text") {
    wrap.append(
      field(
        label,
        input(
          value[key] || "",
          (v) => {
            target.authConfig = { ...value, [key]: v };
            value[key] = v;
            mark(col);
          },
          { placeholder, type },
        ),
      ),
    );
  }
  if (value.type === "inherit")
    wrap.append(
      el("p", {
        class: "muted",
        text: "Uses authentication from the nearest folder or collection.",
      }),
    );
  if (value.type === "bearer")
    authField("Token", "token", "{{token}}", "password");
  if (value.type === "basic") {
    authField("Username", "username", "{{username}}");
    authField("Password", "password", "{{password}}", "password");
  }
  return wrap;
}
function folderView(col, path) {
  let f = col.folders.find((f) => f.path === path);
  if (!f) {
    f = { path, headers: [], vars: [], authConfig: { type: "inherit" } };
    col.folders.push(f);
  }
  const current = subtabs.get(col.id + path) || "overview",
    root = el("div", { class: "view-inner" });
  root.append(
    tabs(
      [
        ["overview", "Overview"],
        ["headers", "Headers"],
        ["vars", "Vars"],
        ["auth", "Auth"],
      ],
      current,
      (id) => {
        subtabs.set(col.id + path, id);
        render();
      },
    ),
    el("h2", { text: "▱  " + path }),
  );
  if (current === "auth") root.append(authEditor(f, col));
  else if (["vars", "headers"].includes(current))
    root.append(kv(f, current, col));
  else
    root.append(
      el("p", {
        class: "muted",
        text: "Folder settings are inherited by requests and nested folders.",
      }),
      button("New Request", () => newRequest(path)),
      button("Rename Folder", () =>
        askName("Rename Folder", path, (name) => {
          if (col.folders.some((x) => x !== f && x.path === name))
            throw Error("Folder already exists.");
          for (const x of col.folders)
            if (x.path === path || x.path.startsWith(path + "/"))
              x.path = name + x.path.slice(path.length);
          for (const r of col.requests)
            if (r.group === path || r.group?.startsWith(path + "/"))
              r.group = name + r.group.slice(path.length);
          for (const t of state.tabs)
            if (t.cid === col.id && t.kind === "folder" && t.id === path)
              t.id = name;
          mark(col);
          open("folder", name, col);
        }),
      ),
    );
  return root;
}
function realtimeKey(col, r) {
  return col.id + ":" + r.id;
}

function realtimeState(col, r) {
  const key = realtimeKey(col, r);
  let value = realtimeSessions.get(key);
  if (!value || value.kind !== r.type) {
    value = {
      key,
      kind: r.type,
      id: null,
      status: "idle",
      connected: false,
      events: [],
      paused: false,
      autoScroll: true,
      filter: "",
      message: "",
      messageFormat: "json",
      startedAt: 0,
    };
    realtimeSessions.set(key, value);
  }
  return value;
}

function realtimeStatusLabel(session) {
  return {
    idle: "대기",
    connecting: "연결 중",
    open: "연결됨",
    reconnecting: "재연결 중",
    error: "오류",
    closed: "종료",
  }[session.status] || session.status;
}

function realtimeEventElement(event, kind) {
  const item = el("li", {
    class: "realtime-request-event type-" + event.type,
  });
  const direction =
    event.type === "sent" ? "→" : event.type === "message" ? "←" : "●";
  const label =
    kind === "sse" && event.type === "message" && event.event
      ? event.event
      : event.type;
  item.append(
    el(
      "div",
      { class: "realtime-request-event-meta" },
      el("time", {
        text: new Date(event.at || Date.now()).toLocaleTimeString(),
      }),
      el("span", { class: "realtime-direction", text: direction }),
      el("span", { class: "realtime-event-type", text: label }),
      event.bytes
        ? el("span", {
            class: "realtime-event-bytes",
            text: Number(event.bytes).toLocaleString() + " B",
          })
        : null,
    ),
  );
  let body = "";
  if (event.type === "message" || event.type === "sent") {
    body = String(event.data ?? "");
    if (!event.binary) {
      try {
        body = JSON.stringify(JSON.parse(body), null, 2);
      } catch {}
    } else {
      body = "[binary · base64]\n" + body;
    }
  } else if (event.type === "error") {
    body = event.message || "연결 오류";
  } else if (event.type === "open") {
    body = event.status
      ? "HTTP " + event.status
      : event.protocol
        ? "protocol " + event.protocol
        : "연결됨";
  } else if (event.type === "reconnecting") {
    body = (event.retry || 3000) + "ms 후 다시 연결";
  } else if (event.type === "closed") {
    body = event.reason || "연결 종료";
  }
  if (body) item.append(el("pre", { text: body }));
  return item;
}

function realtimeRoot(key) {
  return [...document.querySelectorAll("[data-realtime-key]")].find(
    (node) => node.dataset.realtimeKey === key,
  );
}

function realtimeEventMatches(event, session) {
  const query = String(session.filter || "").trim().toLowerCase();
  if (!query) return true;
  return [
    event.type,
    event.event,
    event.data,
    event.message,
    event.reason,
  ]
    .filter((value) => value != null)
    .some((value) => String(value).toLowerCase().includes(query));
}

function realtimeStatsText(session) {
  const messages = session.events.filter((event) =>
    ["message", "sent"].includes(event.type),
  );
  const bytes = messages.reduce((total, event) => total + Number(event.bytes || 0), 0);
  const elapsed = session.startedAt ? Math.max(0, Date.now() - session.startedAt) : 0;
  const seconds = Math.floor(elapsed / 1000);
  const duration =
    seconds >= 60
      ? Math.floor(seconds / 60) + "m " + (seconds % 60) + "s"
      : seconds + "s";
  return (
    messages.length.toLocaleString() +
    (session.kind === "sse" ? " events" : " messages") +
    " · " +
    bytes.toLocaleString() +
    " B" +
    (session.startedAt ? " · " + duration : "")
  );
}

function redrawRealtimeLog(session) {
  const list = realtimeRoot(session.key)?.querySelector(
    "[data-role='realtime-log']",
  );
  if (!list) return;
  list.replaceChildren(
    ...session.events
      .filter((event) => realtimeEventMatches(event, session))
      .map((event) => realtimeEventElement(event, session.kind)),
  );
  if (session.autoScroll) list.scrollTop = list.scrollHeight;
}

function refreshRealtimeDom(key, event = null) {
  const session = realtimeSessions.get(key);
  const root = realtimeRoot(key);
  if (!session || !root) return;
  const stateNode = root.querySelector("[data-role='realtime-state']");
  const connectButton = root.querySelector("[data-role='realtime-connect']");
  const sendButton = root.querySelector("[data-role='realtime-send']");
  const countNode = root.querySelector("[data-role='realtime-count']");
  const list = root.querySelector("[data-role='realtime-log']");
  if (stateNode) {
    stateNode.textContent = realtimeStatusLabel(session);
    stateNode.className =
      "realtime-request-state " +
      (session.connected
        ? "ok"
        : ["connecting", "reconnecting"].includes(session.status)
          ? "pending"
          : session.status === "error"
            ? "error"
            : "idle");
  }
  if (connectButton)
    connectButton.textContent = session.id ? "연결 끊기" : "연결";
  if (sendButton) sendButton.disabled = !session.connected;
  if (countNode) countNode.textContent = realtimeStatsText(session);
  if (
    event &&
    list &&
    !session.paused &&
    realtimeEventMatches(event, session)
  ) {
    list.append(realtimeEventElement(event, session.kind));
    while (list.children.length > 300) list.firstElementChild?.remove();
    if (session.autoScroll) list.scrollTop = list.scrollHeight;
  }
}

api.onRealtimeEvent?.((event) => {
  const key = realtimeById.get(event.id);
  if (!key) return;
  const session = realtimeSessions.get(key);
  if (!session) return;
  session.events.push(event);
  session.events = session.events.slice(-300);
  if (event.type === "open") {
    session.status = "open";
    session.connected = true;
    session.startedAt ||= event.at || Date.now();
  } else if (event.type === "connecting" || event.type === "reconnecting") {
    session.status = event.type;
    session.connected = false;
  } else if (event.type === "error") {
    session.status = "error";
  } else if (event.type === "closed") {
    session.status = "closed";
    session.connected = false;
    session.id = null;
    realtimeById.delete(event.id);
  }
  refreshRealtimeDom(key, event);
});

async function toggleRealtimeConnection(col, r) {
  const session = realtimeState(col, r);
  if (session.id) {
    const id = session.id;
    await api["realtime-close"](id);
    realtimeById.delete(id);
    session.id = null;
    session.connected = false;
    session.status = "closed";
    refreshRealtimeDom(session.key);
    return;
  }
  session.status = "connecting";
  session.connected = false;
  refreshRealtimeDom(session.key);
  try {
    const result = await api["realtime-open"]({
      kind: r.type,
      request: structuredClone(r),
      environment: structuredClone(env(col)),
      collection: structuredClone(col),
      protocols: r.type === "websocket" ? r.websocket?.protocols || [] : [],
      autoReconnect:
        r.type === "sse"
          ? r.sse?.autoReconnect !== false
          : r.websocket?.autoReconnect !== false,
    });
    session.id = result.id;
    session.status = "connecting";
    realtimeById.set(result.id, session.key);
    refreshRealtimeDom(session.key);
    status(r.name + " 연결을 시작했습니다.");
  } catch (error) {
    const event = {
      type: "error",
      at: Date.now(),
      message: error.message,
    };
    session.status = "error";
    session.events.push(event);
    refreshRealtimeDom(session.key, event);
    throw error;
  }
}

async function sendRealtimePayload(col, r, payload, format = "text") {
  const session = realtimeState(col, r);
  if (!session.id || !session.connected)
    throw Error("WebSocket 연결이 열려 있지 않습니다.");
  if (format === "json" && String(payload).trim()) {
    try {
      JSON.parse(payload);
    } catch {
      throw Error("JSON 메시지 형식이 올바르지 않습니다.");
    }
  }
  await api["realtime-send"](session.id, String(payload ?? ""));
}

async function sendRealtimeMessage(col, r) {
  const session = realtimeState(col, r);
  await sendRealtimePayload(
    col,
    r,
    session.message,
    session.messageFormat || "text",
  );
  session.message = "";
  const composer = realtimeRoot(session.key)?.querySelector(
    "[data-role='realtime-message']",
  );
  if (composer) composer.value = "";
}

function realtimeRequestView(col, r) {
  const id = col.id + r.id;
  const current = subtabs.get(id) || "params";
  const session = realtimeState(col, r);
  const root = el("div", {
    class: "request-view realtime-request-view",
    "data-view": "request",
    "data-realtime-key": session.key,
  });
  const saveButton = button(
    "",
    () => saveRequest({ cid: col.id, kind: "request", id: r.id }),
    {
      class: "request-save",
      title: "요청 저장 · ⌘S",
      "aria-label": "현재 요청 저장",
    },
  );
  saveButton.append(
    el("span", { "data-lucide": "save" }),
    el("span", { text: "저장" }),
  );
  root.append(
    el(
      "div",
      { class: "request-heading" },
      el("span", { text: col.title + " / " + (r.group || "Requests") }),
      el("strong", { text: r.name }),
      requestBadge(r),
      el(
        "div",
        { class: "request-heading-actions" },
        saveButton,
        button("⋯", () => requestMenu(col, r), {
          class: "request-menu",
          title: "Request actions",
          "aria-label": "요청 메뉴",
        }),
      ),
    ),
    el(
      "div",
      { class: "urlbar realtime-urlbar" },
      el("span", {
        class: "realtime-url-kind",
        text: r.type === "sse" ? "SSE" : "WS",
      }),
      input(
        r.url,
        (value) => {
          r.url = value;
          mark(col);
        },
        {
          id: "requestUrl",
          spellcheck: false,
          placeholder:
            r.type === "sse"
              ? "https://api.example.com/events"
              : "wss://api.example.com/socket",
        },
      ),
      el("span", {
        class: "realtime-request-state idle",
        "data-role": "realtime-state",
        text: realtimeStatusLabel(session),
      }),
      button(
        session.id ? "연결 끊기" : "연결",
        () => action(() => toggleRealtimeConnection(col, r)),
        {
          class: "realtime-connect-button",
          "data-role": "realtime-connect",
          title: "연결 전환 · ⌘Enter",
        },
      ),
    ),
  );

  const pane = el("div", { class: "request-pane realtime-config-pane" });
  const realtimeTabs =
    r.type === "sse"
      ? [
          ["params", "Params"],
          ["headers", "Headers"],
          ["auth", "Auth"],
          ["vars", "Vars"],
          ["settings", "Settings"],
          ["docs", "Docs"],
        ]
      : [
          ["params", "Params"],
          ["headers", "Headers"],
          ["auth", "Auth"],
          ["protocols", "Protocols"],
          ["vars", "Vars"],
          ["messages", "Messages"],
          ["settings", "Settings"],
          ["docs", "Docs"],
        ];
  pane.append(
    tabs(realtimeTabs, current, (value) => {
      subtabs.set(id, value);
      render();
    }),
  );

  const content = el("div", {
    class: "request-content realtime-config-content",
  });
  if (current === "params") content.append(kv(r, "query", col));
  if (current === "headers") {
    content.append(
      kv(r, "headers", col),
      el("p", {
        class: "hint",
        text:
          r.type === "sse"
            ? "컬렉션·폴더 헤더와 인증 설정을 상속한 뒤 SSE 연결에 적용합니다."
            : "컬렉션·폴더 헤더와 인증 설정을 상속한 뒤 WebSocket handshake에 적용합니다.",
      }),
    );
  }
  if (current === "auth") content.append(authEditor(r, col));
  if (current === "vars") {
    content.append(
      kv(r, "vars", col),
      el("p", {
        class: "hint",
        text: "환경변수와 함께 URL·쿼리·헤더·인증 값의 {{variables}}를 해석합니다.",
      }),
    );
  }
  if (current === "protocols") {
    const protocols = r.websocket?.protocols || [];
    content.append(
      field(
        "WebSocket Subprotocols",
        input(
          protocols.join(", "),
          (value) => {
            r.websocket ||= {
              protocols: [],
              autoReconnect: true,
              messages: [],
            };
            r.websocket.protocols = value
              .split(",")
              .map((item) => item.trim())
              .filter(Boolean);
            mark(col);
          },
          { placeholder: "graphql-ws, chat" },
        ),
      ),
      el("p", {
        class: "hint",
        text: "서버가 요구하는 Sec-WebSocket-Protocol 값을 쉼표로 구분해 입력하세요. 인증·커스텀 handshake 헤더는 Headers/Auth 탭에서 설정할 수 있습니다.",
      }),
    );
  }
  if (current === "messages" && r.type === "websocket") {
    r.websocket ||= { protocols: [], autoReconnect: true, messages: [] };
    const messages = (r.websocket.messages ||= []);
    const addMessage = () => {
      messages.push({
        id: crypto.randomUUID(),
        name: "New message",
        format: "json",
        body: "{\n  \n}",
      });
      mark(col);
      render();
    };
    content.append(
      el(
        "div",
        { class: "saved-message-heading" },
        el("div", {},
          el("h3", { text: "Saved Messages" }),
          el("p", {
            class: "hint",
            text: "자주 보내는 WebSocket payload를 Request와 함께 저장합니다.",
          }),
        ),
        button("+ 메시지", addMessage, { class: "text-button" }),
      ),
    );
    if (!messages.length) {
      content.append(
        el("div", {
          class: "empty-response",
          text: "저장된 메시지가 없습니다.",
        }),
      );
    }
    messages.forEach((message, index) => {
      const body = textarea(
        message.body,
        (value) => {
          message.body = value;
          mark(col);
        },
        {
          rows: 6,
          "aria-label": (message.name || "Message") + " body",
        },
      );
      const card = el(
        "div",
        { class: "saved-message-card" },
        el(
          "div",
          { class: "saved-message-row" },
          input(
            message.name,
            (value) => {
              message.name = value;
              mark(col);
            },
            { "aria-label": "Saved message name", placeholder: "Message name" },
          ),
          select(
            message.format || "json",
            [
              ["json", "JSON"],
              ["text", "Text"],
            ],
            (value) => {
              message.format = value;
              mark(col);
            },
          ),
        ),
        body,
        el(
          "div",
          { class: "saved-message-actions" },
          button(
            "불러오기",
            () => {
              session.message = message.body;
              session.messageFormat = message.format || "text";
              const composer = realtimeRoot(session.key)?.querySelector(
                "[data-role='realtime-message']",
              );
              const format = realtimeRoot(session.key)?.querySelector(
                "[data-role='realtime-message-format']",
              );
              if (composer) composer.value = session.message;
              if (format) format.value = session.messageFormat;
              status(message.name + " 메시지를 작성기에 불러왔습니다.");
            },
            { class: "text-button" },
          ),
          button(
            "보내기",
            () =>
              action(() =>
                sendRealtimePayload(
                  col,
                  r,
                  message.body,
                  message.format || "text",
                ),
              ),
            { class: "text-button" },
          ),
          message.format === "json"
            ? button(
                "JSON 정리",
                () =>
                  action(() => {
                    message.body = JSON.stringify(
                      JSON.parse(message.body || "{}"),
                      null,
                      2,
                    );
                    mark(col);
                    render();
                  }),
                { class: "text-button" },
              )
            : null,
          button(
            "삭제",
            () => {
              messages.splice(index, 1);
              mark(col);
              render();
            },
            { class: "text-button danger" },
          ),
        ),
      );
      content.append(card);
    });
  }

  if (current === "settings") {
    const config = r.type === "sse" ? r.sse : r.websocket;
    content.append(
      el(
        "label",
        { class: "realtime-setting" },
        el("input", {
          type: "checkbox",
          checked: config?.autoReconnect !== false,
          onChange: (event) => {
            if (r.type === "sse") {
              r.sse ||= {};
              r.sse.autoReconnect = event.target.checked;
            } else {
              r.websocket ||= { protocols: [], messages: [] };
              r.websocket.autoReconnect = event.target.checked;
            }
            mark(col);
          },
        }),
        " 자동 재연결",
      ),
      el("p", {
        class: "hint",
        text:
          r.type === "sse"
            ? "서버가 retry 값을 보내면 해당 재연결 간격을 우선합니다."
            : "비정상 종료 시 저장된 연결 설정으로 다시 연결합니다.",
      }),
    );
  }
  if (current === "docs") {
    content.append(
      textarea(
        r.description,
        (value) => {
          r.description = value;
          mark(col);
        },
        {
          "aria-label": "Request documentation",
          placeholder: "이 실시간 요청의 용도와 이벤트 계약을 기록하세요…",
        },
      ),
    );
  }
  pane.append(content);

  const log = el("ol", {
    class: "realtime-request-log",
    "data-role": "realtime-log",
    "aria-live": "polite",
  });
  log.append(
    ...session.events
      .filter((event) => realtimeEventMatches(event, session))
      .map((event) => realtimeEventElement(event, r.type)),
  );
  const dashboard = el(
    "section",
    { class: "realtime-request-dashboard" },
    el(
      "div",
      { class: "realtime-dashboard-toolbar" },
      el("strong", {
        text: r.type === "sse" ? "Event Stream" : "Message Timeline",
      }),
      el("span", {
        class: "realtime-count",
        "data-role": "realtime-count",
        text: realtimeStatsText(session),
      }),
      input(
        session.filter,
        (value) => {
          session.filter = value;
          redrawRealtimeLog(session);
        },
        {
          class: "realtime-filter",
          placeholder: r.type === "sse" ? "event / payload 검색" : "message 검색",
          "aria-label": "실시간 기록 검색",
        },
      ),
      button(
        session.autoScroll ? "자동 스크롤" : "수동 스크롤",
        () => {
          session.autoScroll = !session.autoScroll;
          render();
        },
        { class: "text-button" },
      ),
      button(
        session.paused ? "이어보기" : "일시정지",
        () => {
          session.paused = !session.paused;
          render();
        },
        { class: "text-button" },
      ),
      button(
        "비우기",
        () => {
          session.events = [];
          render();
        },
        { class: "text-button" },
      ),
    ),
    log,
  );

  if (r.type === "websocket") {
    dashboard.append(
      el(
        "div",
        { class: "realtime-composer" },
        select(
          session.messageFormat || "json",
          [
            ["json", "JSON"],
            ["text", "Text"],
          ],
          (value) => {
            session.messageFormat = value;
          },
          {
            "data-role": "realtime-message-format",
            "aria-label": "WebSocket 메시지 형식",
          },
        ),
        textarea(
          session.message,
          (value) => {
            session.message = value;
          },
          {
            rows: 4,
            "data-role": "realtime-message",
            "aria-label": "WebSocket 메시지",
            placeholder: '{ "type": "subscribe" }',
            onKeydown: (event) => {
              if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
                event.preventDefault();
                action(() => sendRealtimeMessage(col, r));
              }
            },
          },
        ),
        button(
          "보내기",
          () => action(() => sendRealtimeMessage(col, r)),
          {
            class: "primary",
            disabled: !session.connected,
            "data-role": "realtime-send",
            title: "메시지 보내기 · ⌘Enter",
          },
        ),
      ),
    );
  }

  root.append(
    el("div", { class: "realtime-request-layout" }, pane, dashboard),
  );
  return root;
}

function requestView(col, r) {
  if (!r) return el("p", { text: "Request no longer exists." });
  r = drafts.get(col.id, r);
  if ((r.type || "http") !== "http") return realtimeRequestView(col, r);
  const id = col.id + r.id,
    current = subtabs.get(id) || "params";
  const root = el("div", { class: "request-view", "data-view": "request" });
  root.append(
    el(
      "div",
      { class: "request-heading" },
      el("span", { text: col.title + " / " + (r.group || "Requests") }),
      el("strong", { text: r.name }),
      openApiBadge(r),
      r.removed
        ? el("span", { class: "pill", text: "Removed from specification" })
        : null,
      el(
        "div",
        { class: "request-heading-actions" },
        (() => {
          const saveButton = button("", () =>
            saveRequest({ cid: col.id, kind: "request", id: r.id }), {
            class: "request-save",
            title: "요청 저장 · ⌘S",
            "aria-label": "현재 요청 저장",
          });
          saveButton.append(
            el("span", { "data-lucide": "save" }),
            el("span", { text: "저장" }),
          );
          return saveButton;
        })(),
        button("⋯", () => requestMenu(col, r), {
          class: "request-menu",
          title: "Request actions",
          "aria-label": "요청 메뉴",
        }),
      ),
    ),
  );
  const urlbar = el(
    "div",
    { class: "urlbar" },
    methodPicker(r.method, (v) => {
      r.method = v;
      mark(col);
      renderTree();
    }),
    input(
      r.url,
      (v) => {
        r.url = v;
        mark(col);
      },
      {
        id: "requestUrl", placeholder: "Enter URL or paste cURL",
        onPaste: (event) => {
          const text = event.clipboardData?.getData("text/plain") || "";
          if (!isCurl(text)) return;
          event.preventDefault();
          action(() => {
            const imported = parseCurl(text);
            Object.assign(r, imported);
            subtabs.set(id, imported.bodyType === "none" ? "headers" : "body");
            responses.delete(id);
            mark(col);
            render();
            status("cURL을 가져왔습니다. 요청 설정을 확인하고 Send를 누르세요.");
          });
        },
      },
    ),
    button(
      busy ? "Cancel" : "Send",
      () =>
        busy
          ? action(() => {
              stopRun = true;
              return api.cancel();
            })
          : sendRequest(col, r),
      { id: "sendRequest", title: "Send request · ⌘Enter" },
    ),
  );
  root.append(urlbar);
  const pane = el("div", { class: "request-pane" });
  pane.append(
    tabs(
      [
        ["params", "Params"],
        ["headers", "Headers"],
        ["body", "Body"],
        ["auth", "Auth"],
        ["vars", "Vars"],
        ["assert", "Tests"],
        ["docs", "Docs"],
      ],
      current,
      (v) => {
        subtabs.set(id, v);
        render();
      },
    ),
  );
  const content = el("div", { class: "request-content" });
  if (current === "params") {
    const schema = parameterSchemaView(r, ["path", "query", "cookie"]);
    if (schema) content.append(schema);
    content.append(kv(r, "query", col));
  }
  if (current === "headers") {
    const schema = parameterSchemaView(r, "header");
    if (schema) content.append(schema);
    content.append(kv(r, "headers", col));
    if (rowList(col.headers).length)
      content.append(
        el("p", {
          class: "hint",
          text: "Collection and folder headers are inherited. Matching request headers override them.",
        }),
      );
  }
  if (current === "body") {
    const schema = requestBodySchemaView(r);
    if (schema) content.append(schema);
    content.append(
      el(
        "div",
        { class: "body-toolbar" },
        select(
          r.bodyType || "json",
          [
            ["json", "JSON"],
            ["text", "Text"],
            ["none", "No Body"],
          ],
          (v) => {
            r.bodyType = v;
            mark(col);
            render();
          },
        ),
        button(
          "Format JSON",
          () =>
            action(() => {
              r.body = JSON.stringify(JSON.parse(r.body), null, 2);
              mark(col);
              render();
            }),
          { class: "text-button" },
        ),
      ),
    );
    if (r.bodyType !== "none")
      content.append(
        textarea(
          r.body,
          (v) => {
            r.body = v;
            mark(col);
          },
          { "aria-label": "Request body" },
        ),
      );
  }
  if (current === "auth") content.append(authEditor(r, col));
  if (current === "vars") {
    content.append(
      el("h3", { text: "Request variables" }),
      kv(r, "vars", col),
      el("h3", { text: "Post-response extraction" }),
      el("p", {
        class: "hint",
        text: "Map a runtime variable to a JSON response path, e.g. token → data.accessToken.",
      }),
    );
    const rows = Object.entries(r.extract || {}).map(([key, value]) => ({
      key,
      value,
      enabled: true,
    }));
    content.append(
      table(
        rows,
        [
          { key: "key", label: "Variable name" },
          { key: "value", label: "Response JSON path" },
        ],
        (rows) => {
          r.extract = Object.fromEntries(
            rows
              .filter((x) => x.enabled !== false && x.key)
              .map((x) => [x.key, x.value]),
          );
          mark(col);
        },
      ),
    );
  }
  if (current === "assert")
    content.append(
      el("p", {
        class: "hint",
        text: "Check res.status, res.responseTime, res.body.field or res.headers.name after each response.",
      }),
      table(
        (r.assertions ||= []),
        [
          { key: "expression", label: "Expression", placeholder: "res.status" },
          {
            key: "operator",
            label: "Operator",
            options: [
              ["equals", "equals"],
              ["notEquals", "not equals"],
              ["contains", "contains"],
              ["exists", "exists"],
              ["lessThan", "less than"],
            ],
          },
          { key: "value", label: "Value", placeholder: "200" },
        ],
        (rows) => {
          r.assertions = rows;
          mark(col);
        },
      ),
    );
  if (current === "docs")
    content.append(
      textarea(
        r.description,
        (v) => {
          r.description = v;
          mark(col);
        },
        {
          "aria-label": "Request documentation",
          placeholder: "Describe this request…",
        },
      ),
    );
  pane.append(content);
  const responsePane = responseView(col, r),
    split = el("div", { class: "request-split " + state.layout }, pane),
    divider = el("div", {
      class: "split-resizer",
      role: "separator",
      tabIndex: 0,
      "aria-label": "Resize request and response",
    });
  split.append(divider, responsePane);
  divider.onpointerdown = (e) => {
    divider.setPointerCapture(e.pointerId);
    const rect = split.getBoundingClientRect();
    divider.onpointermove = (move) => {
      const pct =
        state.layout === "vertical"
          ? (move.clientY - rect.top) / rect.height
          : (move.clientX - rect.left) / rect.width;
      pane.style.flex = "0 0 " + Math.max(20, Math.min(80, pct * 100)) + "%";
    };
    divider.onpointerup = () => (divider.onpointermove = null);
  };
  divider.onkeydown = (e) => {
    if (["ArrowUp", "ArrowLeft", "ArrowDown", "ArrowRight"].includes(e.key)) {
      e.preventDefault();
      pane.style.flex =
        "0 0 " + (["ArrowUp", "ArrowLeft"].includes(e.key) ? 40 : 60) + "%";
    }
  };
  root.append(split);
  return root;
}
function requestMenu(col, r) {
  modal(
    r.name,
    el(
      "div",
      { class: "actions" },
      button("Rename", () =>
        askName("Rename Request", r.name, (name) => {
          r.name = name;
          mark(col);
          render();
        }),
      ),
      button("Duplicate", () => {
        const copy = structuredClone(r);
        copy.id = crypto.randomUUID();
        copy.name += " copy";
        copy.manual = true;
        delete copy.baseline;
        col.requests.push(copy);
        mark(col);
        $("dialog").close();
        open("request", copy.id, col);
      }),
      button("Move to folder", () => {
        let value = r.group || "";
        modal(
          "Move Request",
          field(
            "Folder path (empty for collection root)",
            input(value, (v) => (value = v)),
          ),
          () => {
            r.group = value.trim();
            mark(col);
            render();
          },
        );
      }),
      button(
        "Delete",
        () => {
          modal(
            "Delete Request",
            el("p", { text: "Delete " + r.name + " from this collection?" }),
            () => {
              const realtime = realtimeSessions.get(realtimeKey(col, r));
              if (realtime?.id)
                api["realtime-close"](realtime.id).catch(() => {});
              if (realtime?.id) realtimeById.delete(realtime.id);
              realtimeSessions.delete(realtimeKey(col, r));
              col.requests = col.requests.filter((x) => x.id !== r.id);
              drafts.discard(col.id, r.id);
              state.tabs = state.tabs.filter(
                (t) => !(t.cid === col.id && t.id === r.id),
              );
              mark(col);
              open("overview", null, col);
            },
            "Delete",
          );
        },
        { class: "danger" },
      ),
    ),
    () => true,
    "Close",
  );
}
function logExecution(id, level, message) {
  const entries = executionLogs.get(id) || [];
  entries.push({at:new Date().toLocaleTimeString(), level, message});
  executionLogs.set(id, entries.slice(-100));
}
function responseView(col, r) {
  const id = col.id + r.id,
    res = responses.get(id),
    tab = subtabs.get(id + "response") || "body",
    root = el("div", { class: "response-pane" });
  const tools = el(
    "div",
    { class: "response-tools" },
    el("span", {
      class: "metrics " + (res?.status >= 400 ? "error" : ""),
      text: res
        ? `${res.status || "Error"} · ${res.elapsed || 0} ms · ${(res.bytes || 0).toLocaleString()} B`
        : "",
    }),
    button(
      state.layout === "vertical" ? "◫" : "⬒",
      () => {
        state.layout = state.layout === "vertical" ? "horizontal" : "vertical";
        render();
      },
      { title: "Toggle horizontal / vertical split" },
    ),
    button("Copy", () => action(() => api.copy(res?.body || "")), {
      disabled: !res,
    }),
  );
  root.append(
    el(
      "div",
      { class: "response-toolbar" },
      tabs(
        [
          ["body", "Body"],
          ["headers", "Headers"],
          ...(r.openapi || Object.keys(r.responses || {}).length
            ? [["schema", "Schema"]]
            : []),
          ["tests", "Tests"],
          ["history", "History"],
          ["console", "콘솔"],
        ],
        tab,
        (v) => {
          subtabs.set(id + "response", v);
          render();
        },
      ),
      tools,
    ),
  );
  if (tab === "console") {
    const entries = executionLogs.get(id) || [];
    root.append(button("콘솔 지우기", () => {executionLogs.delete(id); render();}, {class:"clear-console"}));
    if (!entries.length) root.append(el("p",{class:"hint",text:"실행 로그가 없습니다."}));
    root.append(...entries.map(entry => el("div", {
      class:"execution-log " + entry.level,
      text:entry.at + "  " + entry.level.toUpperCase() + "  " + entry.message
    })));
    return root;
  }
  if (tab === "history") {
    const entries = history.filter((h) => h.id === id);
    root.append(
      ...entries.map((h) =>
        el("div", {
          class: "history-entry",
          text: `${h.at}  ${h.method}  ${h.status}  ${h.elapsed} ms`,
        }),
      ),
    );
    if (!entries.length)
      root.append(
        el("div", {
          class: "empty-response",
          text: "No requests sent in this session.",
        }),
      );
    return root;
  }
  if (tab === "schema") {
    root.append(responseSchemaView(r));
    return root;
  }
  if (!res) {
    root.append(
      el("div", {
        class: "empty-response",
        text: "Send a request to view the response　⌘ ↵",
      }),
    );
    return root;
  }
  if (res.error && (tab === "body" || tab === "headers")) {
    root.append(el("div", {class:"empty-response",text:"수신한 응답이 없습니다. 콘솔에서 실행 오류를 확인하세요."}));
    return root;
  }
  if (tab === "tests") {
    const tests = res.tests || [];
    root.append(
      ...tests.map((t) =>
        el(
          "div",
          { class: "run-item" },
          el("span", {
            class: t.passed ? "metrics" : "error",
            text: t.passed ? "✓ PASS" : "× FAIL",
          }),
          el("span", { text: `${t.expression} ${t.operator} ${t.value}` }),
        ),
      ),
    );
    if (!tests.length)
      root.append(
        el("p", {
          class: "hint",
          text: "Add checks in the Assert tab to validate the response.",
        }),
      );
    return root;
  }
  let text =
    tab === "headers" ? JSON.stringify(res.headers, null, 2) : res.body;
  try {
    if (tab === "body") text = JSON.stringify(JSON.parse(text), null, 2);
  } catch {}
  root.append(el("pre", { class: "response-body", text }));
  return root;
}
async function sendRequest(
  col,
  r,
  fromRunner = false,
  fixedEnvironment = null,
  fixedInterceptors = null,
) {
  if (!fromRunner) r = drafts.get(col.id, r);
  if ((r.type || "http") !== "http") {
    if (fromRunner)
      throw Error("실시간 요청은 Collection Runner에서 실행할 수 없습니다.");
    return toggleRealtimeConnection(col, r);
  }
  if (busy && !fromRunner) return;
  const environment = structuredClone(fixedEnvironment || env(col));
  if (!fromRunner) {
    busy = true;
    render();
  }
  logExecution(col.id + r.id, "info", r.method + " 요청 시작 · 환경 " + environment.name);
  status("Sending " + r.name + "…");
  let result;
  try {
    const ready = structuredClone(r);
    if (ready.bodyType === "none") ready.body = "";
    if (
      ready.bodyType === "json" &&
      ready.body &&
      !rowList(ready.headers).some(
        (h) => h.key.toLowerCase() === "content-type",
      )
    ) {
      ready.headers = [
        ...rowList(ready.headers),
        { key: "Content-Type", value: "application/json", enabled: true },
      ];
    }
    result = await api.send(ready, environment, col, structuredClone(fixedInterceptors || col.interceptors || {}));
    for(const line of result.logs || []) logExecution(col.id+r.id,"info",line);
    if(result.scriptError) {logExecution(col.id+r.id,"error",result.scriptError);subtabs.set(col.id+r.id+"response","console");}
    logExecution(col.id + r.id, "info", "HTTP " + result.status + " · " + result.elapsed + " ms");

    status(
      `${r.name}: ${result.status}${result.variables.length ? " · Captured " + result.variables.join(", ") : ""}`,
    );
  } catch (e) {
    const message = e.message.replace(/^Error invoking remote method '[^']+':\s*(?:Error|TypeError):\s*/, "");
    result = { status: 0, body: "", error: message, headers: {}, tests: [], elapsed: 0 };
    logExecution(col.id + r.id, "error", message);
    subtabs.set(col.id + r.id + "response", "console");
    status("요청 실행 실패 · 콘솔을 확인하세요.");
  }
  responses.set(col.id + r.id, result);
  history.unshift({
    id: col.id + r.id,
    at: new Date().toLocaleTimeString(),
    method: r.method,
    status: result.status,
    elapsed: result.elapsed,
  });
  history = history.slice(0, 100);
  if (!fromRunner) busy = false;
  render();
  return result;
}
function scriptsView(col) {
  const interceptors = col.interceptors ||= {enabled:false,before:"",after:""};
  const root=el("div",{class:"view-inner","data-view":"scripts"});
  root.append(el("h2",{text:"Collection Interceptors"}),
    el("p",{class:"muted",text:"이 컬렉션의 단일 요청과 컬렉션 실행에만 적용합니다. Before Request는 전송 직전, After Response는 응답 수신 뒤 실행합니다."}),
    el("label",{},el("input",{type:"checkbox",checked:interceptors.enabled,onChange:e=>{interceptors.enabled=e.target.checked;mark(col);}})," 활성화"),
    field("Before Request · req, ctx",textarea(interceptors.before,v=>{interceptors.before=v;mark(col);},{"aria-label":"Before Request Interceptor",placeholder:'req.headers.set("Authorization", "Bearer " + ctx.vars.get("accessToken"));'})),
    field("After Response · req, res, ctx",textarea(interceptors.after,v=>{interceptors.after=v;mark(col);},{"aria-label":"After Response Interceptor",placeholder:'if (res.status === 200) ctx.vars.set("accessToken", res.json().accessToken);'})),
    el("pre",{class:"code-block",text:`req.method / req.url / req.body
req.headers.get / set / delete
res.status / res.headers.get / res.text() / res.json()
ctx.env.get("KEY")
ctx.vars.get / set / delete
ctx.log("실행 로그")`}),
    button("저장",()=>save(),{class:"primary"}),
    el("p",{class:"hint",text:"Interceptor 로그는 요청의 콘솔에서 확인합니다. 파일·셸·직접 네트워크 API는 제공하지 않습니다."}));
  return root;
}
function environments(col) {
  const root = el("div", { class: "view-inner", "data-view": "environments" }),
    current = env(col);
  root.append(
    el(
      "div",
      { class: "page-heading" },
      el("h2", { text: "환경변수" }),
      button(".env 파일 연결", () => action(async () => {
        const file=await api["env-connect"](); if(!file) return;
        let linked=col.environments.find(e=>e.file?.path===file.path);
        if(!linked) {
          linked={id:crypto.randomUUID(),name:file.name,values:file.values,file};
          col.environments.push(linked);
        }
        state.selectedEnvironments[col.id]=linked.id; mark(col); render();
      }),{id:"connectEnvFile"}),
      el(
        "div",
        { class: "actions" },
        button("Import .env", () =>
          action(async () => {
            const values = await api["import-env"]();
            if (values) {
              Object.assign(current.values, values);
              mark(col);
              render();
            }
          }),
        ),
        button("+ Create", () =>
          askName("Create Environment", "", (name) => {
            const e = { id: crypto.randomUUID(), name, values: {} };
            col.environments.push(e);
            state.selectedEnvironments[col.id] = e.id;
            mark(col);
            render();
          }),
        ),
      ),
    ),
  );
  const list = el(
      "div",
      { class: "env-list" },
      el("h3", { text: "Collection" }),
      col.environments.map((e) =>
        button(
          e.name,
          () => {
            state.selectedEnvironments[col.id] = e.id;
            render();
          },
          { class: e === current ? "active" : "" },
        ),
      ),
    ),
    details = el("div");
  details.append(
    el(
      "div",
      { class: "page-heading" },
      el("h2", { text: current.name }),
      el(
        "div",
        { class: "actions" },
        button("Rename", () =>
          askName("Rename Environment", current.name, (name) => {
            current.name = name;
            mark(col);
            render();
          }),
        ),
        button("Duplicate", () => {
          const copy = structuredClone(current);
          copy.id = crypto.randomUUID();
          copy.name += " copy";
          delete copy.file;
          col.environments.push(copy);
          state.selectedEnvironments[col.id] = copy.id;
          mark(col);
          render();
        }),
        button(
          "Delete",
          () => {
            if (col.environments.length === 1) {
              status("Keep at least one environment.");
              return;
            }
            modal(
              "Delete Environment",
              el("p", { text: "Delete " + current.name + "?" }),
              () => {
                col.environments = col.environments.filter(
                  (e) => e !== current,
                );
                mark(col);
                render();
              },
              "Delete",
            );
          },
          { class: "danger" },
        ),
      ),
    ),
  );
  if(current.file) {
    details.append(el("p",{class:"muted",text:current.file.path}),
      textarea(current.file.text,text=>{current.file.text=text;mark(col);},{"aria-label":"환경 파일 내용"}),
      el("div",{class:"actions"},
        button("편집 내용 적용",()=>action(async()=>{
          current.values=await api["env-parse"](current.file.text); mark(col);render();
          status("선택 환경에 적용했습니다. 파일 저장은 별도입니다.");
        })),
        button("파일 저장",()=>action(async()=>{
          const file=await api["env-write"](current.file.path,current.file.text,current.file.revision);
          current.file=file;current.values=file.values;mark(col);render();
        })),
        button("다시 읽기",()=>modal("환경 파일 다시 읽기",
          el("p",{text:"편집 중인 내용을 파일의 최신 내용으로 바꿉니다."}),
          async()=>{const file=await api["env-read"](current.file.path);current.file=file;current.values=file.values;mark(col);render();},
          "다시 읽기"))
      ));
  }
  let revealed = false;
  const rows = Object.entries(current.values).map(([key, value]) => ({
      key,
      value,
      enabled: true,
    })),
    area = el("div");
  function redraw() {
    area.replaceChildren(
      table(
        rows,
        columns,
        (rows) => {
          current.values = Object.fromEntries(
            rows
              .filter((r) => r.enabled !== false && r.key)
              .map((r) => [r.key, r.value]),
          );
          mark(col);
        },
        { secrets: !revealed },
      ),
    );
    if(current.file) area.querySelectorAll("input,button,select").forEach(node=>node.disabled=true);
  }
  details.append(
    el(
      "div",
      { class: "actions" },
      button(
        "Show / hide values",
        () => {
          revealed = !revealed;
          redraw();
        },
        { class: "text-button" },
      ),
    ),
    area,
    el("p", {
      class: "hint",
      text: "Save keeps this workspace encrypted locally. Export and Git sharing include variable names with empty values. Runtime tokens are kept only for this session.",
    }),
    button("Clear runtime tokens", () =>
      action(async () => {
        await api["clear-tokens"]();
        status("Runtime tokens cleared.");
      }),
    ),
  );
  redraw();
  if(current.file) area.querySelectorAll("input,button,select").forEach(node=>node.disabled=true);
  root.append(el("div", { class: "env-layout" }, list, details));
  return root;
}
function specView(col) {
  const auth = specAuthEditor(specAuths.get(col.id, col.source), value => specAuths.set(col.id, col.source, value));
  const root = el("div", { class: "view-inner", "data-view": "spec" });
  root.append(
    el(
      "div",
      { class: "page-heading" },
      el("h2", { text: "API Specifications" }),
      button("Import OpenAPI file", () =>
        action(async () => {
          const imported = await api["import-spec"]();
          if (!imported) return;
          col.sourceFile=imported.sourceFile;mark(col);
          beginSyncReview(col, {...imported, generated:imported.requests});
        }),
      ),
    ),
  );
  root.append(
    el("p", {
      class: "muted",
      text: "OpenAPI 3.x 파일 또는 URL을 연결하고 변경을 검토합니다.",
    }),
    field(
      "Specification URL",
      input(
        col.source,
        (v) => {
          const changed = String(col.source || "").trim() !== v.trim();
          col.source = v;
          if (changed) auth.reset();
          mark(col);
        },
        { placeholder: "https://api.example.com/openapi.json" },
      ),
    ),
    auth.element,
    button(
      "↻ Synchronize",
      () =>
        action(async () => {
          if (!col.source) throw Error("Enter an OpenAPI URL.");
          status("Synchronizing specification…");
          const result = await api["sync-spec"](col.source, col.requests, auth.value());
          beginSyncReview(col, result);
        }),
      { class: "primary" },
    ),
    el("h2", { text: "Last synchronization" }),
    el("p", {
      class: "muted",
      text: col.lastSync || "No specification synchronized yet.",
    }),

  );
  if(col.syncUndo) root.append(button("직전 명세 반영 복원", () => modal(
    "직전 명세 반영 복원", el("p",{text:"요청과 실행 목록을 직전 반영 전 상태로 되돌립니다. 반영 이후의 요청 수정도 되돌아갑니다."}),
    async () => {
      if(col.requests.some(r=>drafts.changed(col.id,r))) throw Error("요청 편집을 먼저 저장하거나 버려주세요.");
      const restored=structuredClone(col);Object.assign(restored,col.syncUndo);delete restored.syncUndo;
      await saveCollectionTransaction(col,restored);
      col.requests.forEach(r=>drafts.discard(col.id,r.id));syncReviews.delete(col.id);render();
      status("직전 명세 반영을 복원했습니다.");
    }, "복원"), {id:"undoSync"}));
  if(col.sourceFile) root.append(el("div",{class:"actions"},
    el("span",{class:"muted",text:col.sourceFile}),
    button("연결한 명세 파일 다시 읽기",()=>action(async()=>{
      const result=await api["sync-spec-file"](col.sourceFile);
      beginSyncReview(col,{...result,generated:result.requests});
    }),{id:"reloadSpecFile"}),
    button("파일 연결 해제",()=>{delete col.sourceFile;mark(col);render();})));
  const pending = syncReviews.get(col.id);
  if (pending) root.append(reviewView(pending.review, (selected, choices) => action(async () => {
    if (col.requests.some(r => selected.includes(r.id) && drafts.changed(col.id,r)))
      throw Error("선택한 요청에 저장하지 않은 편집이 있습니다. 먼저 저장하거나 버린 후 다시 검토하세요.");
    const requests = applyReview(col.requests, pending.review, selected, choices);
    await applySync(col, {...pending.result,requests,counts:{
      added:pending.review.changes.filter(c=>selected.includes(c.id)&&c.type==="added").length,
      updated:pending.review.changes.filter(c=>selected.includes(c.id)&&c.type==="updated").length,
      removed:pending.review.changes.filter(c=>selected.includes(c.id)&&c.type==="removed").length
    }}, selected);
  })));
  return root;
}
function beginSyncReview(col, result) {
  syncReviews.set(col.id,{result,review:preview(col.requests,result.generated)});
  render();
  status("변경 검토 후 반영할 엔드포인트를 선택하세요.");
}
async function saveCollectionTransaction(col,next) {
  const snapshot=structuredClone(state);
  snapshot.collections=snapshot.collections.map(c=>c.id===col.id?next:c);
  snapshot.collapsed=[...collapsed];
  snapshot.tabs=snapshot.tabs.filter(t=>t.cid!==col.id || t.kind!=="request" || next.requests.some(r=>r.id===t.id));
  const workspace=document.querySelector(".workspace");workspace.inert=true;
  try {await api["workspace-save"](snapshot);}
  finally {workspace.inert=false;}
  for(const key of Object.keys(col)) delete col[key];
  Object.assign(col,next);state.tabs=snapshot.tabs;
  dirty.clear();
  await api["set-dirty"](state.collections.some(c=>c.requests.some(r=>drafts.changed(c.id,r))));
}
async function applySync(col, result, selected) {
  const next=structuredClone(col);
  next.syncUndo={requests:structuredClone(col.requests),runPlan:structuredClone(col.runPlan || []),title:col.title,lastSync:col.lastSync || ""};
  next.requests=result.requests;
  if(!col.requests.length) next.title=result.title || col.title;
  if(next.runPlan) next.runPlan=next.runPlan.filter(item=>next.requests.some(r=>r.id===item.id));
  const n=result.counts;
  const changesApplied = hasSyncChanges(col, next);
  next.lastSync=new Date().toLocaleString()+" · "+n.added+" 추가 · "+n.updated+" 수정 · "+n.removed+" 삭제";
  await saveCollectionTransaction(col,next);
  selected.forEach(id=>drafts.discard(col.id,id));
  syncReviews.delete(col.id);render();status(col.lastSync);
  const offerCommit = () => {
    const repository = gitInfo.get(col.id);
    if (!changesApplied || !repository?.root || !state.collections.includes(col)) return;
    offerSyncCommit({
      collection: col, repository, counts: n, api, modal, status,
      onCommitted(info) { gitInfo.set(col.id, info); render(); },
    });
  };
  const target = env(col);
  if (!String(target.values.baseUrl || "").trim() && result.baseUrl) {
    let proposed = result.baseUrl;
    modal("baseUrl 등록", el("div", {},
      el("p", {text:target.name + " 환경에 baseUrl이 없습니다. 명세의 서버 주소를 등록할까요?"}),
      field("baseUrl", input(proposed, value => proposed = value, {id:"suggestedBaseUrl"})),
      el("p", {class:"hint",text:"취소하면 명세 변경만 유지하고 환경변수는 등록하지 않습니다."})
    ), () => {
      let parsed;
      try { parsed = new URL(proposed); } catch { throw Error("절대 URL을 입력하세요."); }
      if (!["http:", "https:"].includes(parsed.protocol)) throw Error("HTTP/HTTPS 주소를 입력하세요.");
      target.values.baseUrl = proposed;
      mark(col); render();
      status(target.name + " 환경에 baseUrl을 등록했습니다. 저장 버튼으로 보관하세요.");
    }, "등록");
    // The baseUrl dialog must finish (confirm OR cancel) before offering Git.
    $("dialog").addEventListener("close", () => action(offerCommit), { once: true });
  } else {
    offerCommit();
  }
}
function endpointPicker(col) {
  const chosen = new Set(), existing = new Set(runPlan(col).map(x => x.id));
  const list = el("div", { class: "endpoint-picker" });
  function draw(query = "") {
    list.replaceChildren();
    const matches = col.requests.filter(
      r =>
        (!r.type || r.type === "http") &&
        (r.name + " " + r.method + " " + r.url + " " + r.group)
          .toLowerCase()
          .includes(query.toLowerCase()),
    );
    for (const r of matches) list.append(el("label", {class:"run-item"},
      el("input", {type:"checkbox", checked:existing.has(r.id) || chosen.has(r.id), disabled:existing.has(r.id),
        onChange:e => e.target.checked ? chosen.add(r.id) : chosen.delete(r.id)}),
      requestBadge(r),
      el("span", {text:(r.group ? r.group + " / " : "") + r.name}),
      el("small", {text:existing.has(r.id) ? "추가됨" : r.url})));
    if (!matches.length) list.append(el("p",{class:"muted",text:"일치하는 저장 요청이 없습니다."}));
  }
  draw();
  modal("엔드포인트 추가", el("div", {},
    input("", draw, {placeholder:"이름·메서드·URL 검색", "aria-label":"엔드포인트 검색"}), list
  ), () => { addToRun(col, chosen); mark(col); render(); }, "선택한 요청 추가");
}
function runnerView(col) {
  const root = el("div", {class:"view-inner", "data-view":"runner"});
  const plan = runPlan(col);
  root.append(el("div", {class:"page-heading"},
    el("h2", {text:"컬렉션 실행"}),
    button(busy ? "중지" : "선택한 요청 실행", () => busy
      ? action(() => { stopRun = true; return api.cancel(); })
      : runCollection(col), {class:"primary",id:"runSelected"})),
    el("p", {class:"muted",text:env(col).name + " 환경에서 저장된 요청을 순서대로 실행합니다."}),
    el("div", {class:"actions"},
      button("+ 엔드포인트 추가", () => endpointPicker(col), {id:"addEndpoints",disabled:busy}),
      button("전체 선택", () => { plan.forEach(x => x.enabled = true); mark(col); render(); }, {disabled:busy}),
      button("선택 해제", () => { plan.forEach(x => x.enabled = false); mark(col); render(); }, {disabled:busy}),
      el("label", {}, el("input", {type:"checkbox",checked:!!col.stopOnFailure,disabled:busy,
        onChange:e => {col.stopOnFailure = e.target.checked; mark(col);}}), " 실패 시 중단")));
  if (!plan.length) root.append(el("p",{class:"hint",text:"엔드포인트 추가에서 실행할 저장 요청을 선택하세요."}));
  plan.forEach((item, i) => {
    const r = col.requests.find(r => r.id === item.id), result = runnerResults.get(col.id + r.id);
    const move = offset => {
      [plan[i], plan[i+offset]] = [plan[i+offset], plan[i]];
      mark(col); render();
    };
    root.append(el("div", {class:"run-item"},
      el("input", {type:"checkbox",checked:item.enabled,disabled:busy,"aria-label":r.name + " 실행",
        onChange:e => {item.enabled=e.target.checked; mark(col);}}),
      requestBadge(r),
      button(r.name, () => open("request",r.id,col), {class:"text-button"}),
      button("↑", () => move(-1), {disabled:busy || i===0,title:"위로"}),
      button("↓", () => move(1), {disabled:busy || i===plan.length-1,title:"아래로"}),
      button("제외", () => {col.runPlan=plan.filter(x => x.id!==item.id); mark(col); render();},{disabled:busy,"data-exclude":r.id}),
      el("span", {class:"result " + (result && !runFailed(result) ? "metrics":"error"),
        text:result ? (result.status || "오류") + " · " + (result.elapsed || 0) + " ms" : "대기"}),
      result ? button("결과", () => modal(r.name + " 실행 결과", el("div", {},
        el("p",{text:result.error || ("HTTP " + result.status)}),
        ...(result.tests || []).map(t => el("p",{text:JSON.stringify(t)})),
        el("pre",{class:"response-body",text:result.body || ""})), () => true, "닫기")) : null));
  });
  return root;
}
function runFailed(result) {
  return !result || result.scriptError || !result.status || result.status >= 400 || result.tests?.some(t => !t.passed);
}
async function runCollection(col) {
  if (busy) return;
  const selected = structuredClone(
      executionRequests(col),
    ),
    runEnvironment = structuredClone(env(col)),
    runContext = structuredClone(col),
    stopOnFailure = !!col.stopOnFailure,
    runInterceptors = structuredClone(col.interceptors || {});
  if (!selected.length) {
    status("Select requests to run.");
    return;
  }
  busy = true;
  stopRun = false;
  selected.forEach(r => runnerResults.delete(col.id + r.id));
  render();
  let count = 0;
  try {
    for (const r of selected) {
      if (stopRun) break;
      const result = await sendRequest(runContext, r, true, runEnvironment, runInterceptors);
      runnerResults.set(col.id + r.id, result);
      count++;
      render();
      if (stopOnFailure && runFailed(result)) { stopRun = true; break; }
    }
  } finally {
    busy = false;
    render();
    status(
      `Collection run ${stopRun ? "stopped" : "complete"}: ${count}/${selected.length} requests.`,
    );
  }
}
function gitView(col) {
  const root = el("div", { class: "view-inner", "data-view": "git" }),
    info = gitInfo.get(col.id);
  root.append(
    el(
      "div",
      { class: "page-heading" },
      el("h2", { text: "Git" }),
      el("div", { class: "actions" },
        button("새 저장소 만들기", () => createGitRepositoryDialog({
          collectionId: col.id, api, modal, status,
          onCreated(info) { gitInfo.set(col.id, info); render(); },
        }), { id: "gitCreateRepository", class: "primary" }),
        button("Open repository folder", () =>
          action(async () => {
            const r = await api["git-open"](col.id);
            if (r) {
              gitInfo.set(col.id, r);
              render();
            }
          }),
        ),
      ),
    ),
  );
  root.append(
    el("p", {
      class: "muted",
      text:
        info?.root ||
        "Open an existing local Git repository or create a new folder and repository to share this collection.",
    }),
  );
  if (!info) return root;
  root.append(el("h3",{text:"최근 컬렉션 커밋"}),
    ...(info.commits?.length ? info.commits.map(commit => el("p", {text:commit.hash + " · " + commit.message})) : [el("p",{class:"muted",text:"아직 커밋이 없습니다."})]));

  root.append(
    el("p", { text: "Branch: " + info.branch }),
    el("pre", {
      class: "code-block",
      text: info.status || "Working tree clean",
    }),
    el(
      "div",
      { class: "actions" },
      button("Save collection to repository", () => {
        modal(
          "Save Shared Collection",
          el("p", {
            text: "Environment values are excluded. Replace any credentials written directly in URLs, headers or bodies with {{variables}} before sharing.",
          }),
          async () => {
            gitInfo.set(col.id, await api["git-save"](col));
            render();
          },
          "Save",
        );
      }),
      button("Refresh", () =>
        action(async () => {
          gitInfo.set(col.id, await api["git-status"](col.id));
          render();
        }),
      ),
      button("View Diff", () =>
        action(async () => {
          const text = await api["git-diff"](col.id);
          modal(
            "Collection Diff",
            el("pre", {
              class: "code-block",
              text:
                text || "No tracked diff. New files appear in the status list.",
            }),
            () => true,
            "Close",
          );
        }),
      ),
    ),
  );
  let message = "Update API collection";
  root.append(
    field(
      "Commit message",
      input(message, (v) => (message = v)),
    ),
    button(
      "Commit collection",
      () =>
        action(async () => {
          gitInfo.set(col.id, await api["git-commit"](col.id, message));
          status("Collection committed.");
          render();
        }),
      { class: "primary" },
    ),
    el("p", {
      class: "hint",
      text: "Only open-api.collection.json is committed. Other staged files are preserved. Use your Git client for push and pull.",
    }),
  );
  return root;
}
async function persist(only = null) {
  const snapshot = drafts.snapshot(state, only);
  snapshot.collapsed = [...collapsed];
  const workspace=document.querySelector(".workspace");workspace.inert=true;
  try {await api["workspace-save"](snapshot);} finally {workspace.inert=false;}
  // Commit only after durable storage succeeds; preserve object references used by views.
  for (const col of state.collections) {
    const saved = snapshot.collections.find(c => c.id === col.id);
    for (const request of col.requests) {
      if (only && (only.cid !== col.id || only.id !== request.id)) continue;
      const next = saved.requests.find(r => r.id === request.id);
      for (const name of Object.keys(request)) delete request[name];
      Object.assign(request, next);
    }
  }
  dirty.clear();
  for (const col of state.collections)
    if (col.requests.some(r => drafts.changed(col.id, r))) dirty.add(col.id);
  await api["set-dirty"](dirty.size > 0);
  renderTabs();
}
async function saveRequest(tab = active()) {
  if (!tab || tab.kind !== "request") {
    status("저장할 요청 탭을 선택하세요.");
    return;
  }
  const col = state.collections.find((item) => item.id === tab.cid);
  const target = col?.requests.find((item) => item.id === tab.id);
  if (!col || !target) {
    status("저장할 요청을 찾을 수 없습니다.");
    return;
  }
  await action(async () => {
    await persist(tab);
    drafts.discard(col.id, target.id);
    render();
    status(target.name + " 요청을 저장했습니다.");
  });
}
async function save() {
  await action(async () => {
    await persist();
    render();
    status("워크스페이스를 저장했습니다.");
  });
}
async function exportCollection(col) {
  modal(
    "Export Collection",
    el("p", {
      text: "Environment values and runtime tokens are excluded. Values written directly in requests are included; use {{variables}} for credentials.",
    }),
    async () => {
      if (await api["save-collection"](col)) {
        status("Collection exported.");
      }
    },
    "Export",
  );
}
function addCollection(col, kind = "overview") {
  state.collections.push(col);
  mark(col);
  open(kind, null, col);
}
function startBlankCollection() {
  askName("Create Collection", "", (name) => addCollection(collection(name)));
}
function startOpenApiCollection() {
  let source = "";
  const auth = specAuthEditor();
  modal(
    "OpenAPI로 시작하기",
    el(
      "div",
      {},
      el("p", { class: "muted", text: "OpenAPI 3.x 파일 또는 URL에서 새 컬렉션을 시작합니다." }),
      field(
        "Specification URL",
        input(source, (value) => {
          if (source.trim() !== value.trim()) auth.reset();
          source = value;
        }, {
          placeholder: "https://api.example.com/openapi.json",
        }),
      ),
      auth.element,
      el(
        "div",
        { class: "actions" },
        button("OpenAPI 파일 선택", () =>
          action(async () => {
            const imported = await api["import-spec"]();
            if (!imported) return;
            const col = collection(imported.title || "OpenAPI Collection");
            col.sourceFile = imported.sourceFile;
            $("dialog").close();
            addCollection(col, "spec");
            beginSyncReview(col, {...imported, generated: imported.requests});
          }),
        ),
      ),
    ),
    async () => {
      source = source.trim();
      if (!source) throw Error("OpenAPI URL을 입력하거나 파일을 선택하세요.");
      status("OpenAPI 명세를 불러오는 중…");
      const result = await api["sync-spec"](source, [], auth.value());
      const col = collection(result.title || "OpenAPI Collection");
      col.source = source;
      specAuths.set(col.id, source, auth.value());
      addCollection(col, "spec");
      beginSyncReview(col, result);
    },
    "URL로 시작",
  );
}
function newCollectionFlow() {
  modal(
    "새 컬렉션",
    el(
      "div",
      { class: "actions" },
      button("빈 컬렉션으로 시작", startBlankCollection),
      button("OpenAPI로 시작하기", startOpenApiCollection, { class: "primary" }),
    ),
    () => true,
    "닫기",
  );
}
$("newCollection").onclick = newCollectionFlow;
$("importCollectionFile").onclick = () =>
  action(async () => {
    $("collectionActions").hidePopover();
    const value = await api["open-collection"]();
    if (value) {
      const col = normalize(value);
      if (state.collections.some((c) => c.id === col.id))
        col.id = crypto.randomUUID();
      state.collections.push(col);
      mark(col);
      open("overview", null, col);
    }
  });
$("openCollection").addEventListener("click", () => {
  const rect = $("openCollection").getBoundingClientRect();
  $("collectionActions").style.top = rect.bottom + 6 + "px";
  $("collectionActions").style.left = "10px";
});
$("collectionActions").addEventListener("toggle", event => {
  $("openCollection").setAttribute("aria-expanded", String(event.newState === "open"));
});
$("exportActiveCollection").onclick = () => {
  $("collectionActions").hidePopover();
  exportCollection(c());
};
$("scriptsButton").onclick = () => open("scripts");
$("newRequest").onclick = () => newRequest();
$("collectionHome").onclick = () => open("overview");
$("collectionSwitch").addEventListener("click", () => {
  const picker = $("collectionPicker");
  picker.replaceChildren(...state.collections.map(col =>
    button(col.title + (col.id === c().id ? " ✓" : ""), () => {
      picker.hidePopover();
      open("overview", null, col);
    }, {"aria-current": col.id === c().id ? "true" : "false"})
  ));
  const rect = $("collectionSwitch").getBoundingClientRect();
  picker.style.top = rect.bottom + 6 + "px";
  picker.style.left = Math.max(8, rect.right - 240) + "px";
});
$("collectionPicker").addEventListener("toggle", event => {
  $("collectionSwitch").setAttribute("aria-expanded", String(event.newState === "open"));
});

$("envButton").onclick = () => open("environments");
$("specButton").onclick = () => open("spec");
$("gitButton").onclick = () => open("git");
$("runnerButton").onclick = () => open("runner");
$("saveWorkspace").onclick = save;
$("search").oninput = renderTree;
$("searchButton").onclick = () => $("search").focus();
$("environmentSelect").onchange = (e) => {
  state.selectedEnvironments[c().id] = e.target.value;
  render();
};
$("shortcuts").onclick = () =>
  modal(
    "Keyboard Shortcuts",
    el(
      "div",
      { class: "shortcut-list" },
      ...[
        "Send request",
        "⌘ / Ctrl + Enter",
        "Save current request",
        "⌘ / Ctrl + S",
        "New request",
        "⌘ / Ctrl + N",
        "Close tab",
        "⌘ / Ctrl + W",
        "Search requests",
        "⌘ / Ctrl + K",
      ].map((text) => el("span", { text })),
    ),
    () => true,
    "Close",
  );
api.onShortcut((key) => {
  if ($("dialog").open) return;
  if (key === "s") saveRequest();
  if (key === "n") newRequest();
  if (key === "w" && active()) closeTab(active());
  if (key === "k") $("search").focus();
  if (key === "enter" && active()?.kind === "request")
    sendRequest(
      c(),
      c().requests.find((r) => r.id === active().id),
    );
});
document.addEventListener("keydown", (e) => {
  if (!(e.metaKey || e.ctrlKey) || $("dialog").open) return;
  const k = e.key.toLowerCase();
  if (["s", "n", "w", "k", "enter"].includes(k)) e.preventDefault();
  if (k === "s") saveRequest();
  if (k === "n") newRequest();
  if (k === "w" && active()) closeTab(active());
  if (k === "k") $("search").focus();
  if (k === "enter" && active()?.kind === "request")
    sendRequest(
      c(),
      c().requests.find((r) => r.id === active().id),
    );
});
const resize = $("sidebarResizer");
resize.onpointerdown = (e) => {
  resize.setPointerCapture(e.pointerId);
  resize.onpointermove = (e) =>
    document.documentElement.style.setProperty(
      "--sidebar",
      Math.max(200, Math.min(520, e.clientX)) + "px",
    );
  resize.onpointerup = () => (resize.onpointermove = null);
};
resize.onkeydown = (e) => {
  if (["ArrowLeft", "ArrowRight"].includes(e.key)) {
    e.preventDefault();
    const width = parseFloat(
      getComputedStyle(document.documentElement).getPropertyValue("--sidebar"),
    );
    document.documentElement.style.setProperty(
      "--sidebar",
      Math.max(200, Math.min(520, width + (e.key === "ArrowLeft" ? -20 : 20))) +
        "px",
    );
  }
};
window.appReady = (async () => {
    const saved = await action(() => api["workspace-load"]());
    if (saved && Array.isArray(saved.collections)) {
      state = saved;
      const legacyInterceptors = state.globalScripts;
      state.collections.forEach((col) => {
        if (!col.interceptors && legacyInterceptors)
          col.interceptors = structuredClone(legacyInterceptors);
        normalize(col);
      });
      delete state.globalScripts;
      state.selectedEnvironments ||= {};
      state.tabs ||= [];
      state.layout ||= "vertical";
      collapsed = new Set(state.collapsed || []);
    }
    if (state.collections.length) {
      state.activeCollection ||= state.collections[0].id;
      if (!state.activeTab) open("overview");
      else render();
    } else {
      state.activeCollection = null;
      state.activeTab = null;
      render();
    }
  })();
