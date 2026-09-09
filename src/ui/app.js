import { $, el, button, input, select, textarea, field, table } from "./dom.js";
import { collection, request, normalize, rowList } from "./model.js";
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
  history = [],
  busy = false,
  stopRun = false,
  runnerResults = new Map(),
  runnerSelection = new Set(),
  gitInfo = new Map(),
  subtabs = new Map();
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
  askName("New HTTP Request", "", (name) => {
    const r = request(group);
    r.name = name;
    col.requests.push(r);
    mark(col);
    open("request", r.id, col);
  });
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
      `${r.name} ${r.url} ${r.method} ${r.group}`
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
          el("span", { class: "method " + req.method, text: req.method }),
          el("span", { text: req.name + (req.removed ? " ⚠" : "") }),
        );
        r.append(b);
        root.append(r);
      }
    }
    draw(tree);
  }
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
      tab.append(el("span", { class: "method " + r?.method, text: r?.method }));
    }
    tab.append(el("span", { class: "label", text: tabTitle(t) }));
    if (dirty.has(t.cid))
      tab.append(
        el("span", {
          class: "dirty-dot",
          text: "●",
          title: "Unsaved collection changes",
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
    button("＋", () => newRequest(), {
      class: "text-button",
      title: "New request",
    }),
  );
}
function render() {
  renderTree();
  renderTabs();
  $("activeTitle").textContent = c().title;
  const es = $("environmentSelect");
  es.replaceChildren(
    ...c().environments.map((e) => el("option", { value: e.id, text: e.name })),
  );
  es.value = env(c()).id;
  $("branchStatus").textContent = gitInfo.get(c().id)?.branch || "";
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
  const col = c();
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
function requestView(col, r) {
  if (!r) return el("p", { text: "Request no longer exists." });
  const id = col.id + r.id,
    current = subtabs.get(id) || "params";
  const root = el("div", { class: "request-view", "data-view": "request" });
  root.append(
    el(
      "div",
      { class: "request-heading" },
      el("span", { text: col.title + " / " + (r.group || "Requests") }),
      el("strong", { text: r.name }),
      r.removed
        ? el("span", { class: "pill", text: "Removed from specification" })
        : null,
      button("⋯ Request", () => requestMenu(col, r)),
    ),
  );
  const urlbar = el(
    "div",
    { class: "urlbar" },
    select(
      r.method,
      ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS", "TRACE"].map(
        (m) => [m, m],
      ),
      (v) => {
        r.method = v;
        mark(col);
        renderTree();
      },
    ),
    input(
      r.url,
      (v) => {
        r.url = v;
        mark(col);
      },
      { id: "requestUrl", placeholder: "Enter request URL" },
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
        ["body", "Body"],
        ["headers", "Headers"],
        ["auth", "Auth"],
        ["vars", "Vars"],
        ["assert", "Assert"],
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
  if (current === "params") content.append(kv(r, "query", col));
  if (current === "headers") {
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
              col.requests = col.requests.filter((x) => x !== r);
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
          ["tests", "Tests"],
          ["history", "History"],
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
  if (!res) {
    root.append(
      el("div", {
        class: "empty-response",
        text: "Send a request to view the response　⌘ ↵",
      }),
    );
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
) {
  if (busy && !fromRunner) return;
  const environment = structuredClone(fixedEnvironment || env(col));
  if (!fromRunner) {
    busy = true;
    render();
  }
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
    result = await api.send(ready, environment, col);
    status(
      `${r.name}: ${result.status}${result.variables.length ? " · Captured " + result.variables.join(", ") : ""}`,
    );
  } catch (e) {
    result = { status: 0, body: e.message, headers: {}, tests: [], elapsed: 0 };
    status(e.message);
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
function environments(col) {
  const root = el("div", { class: "view-inner", "data-view": "environments" }),
    current = env(col);
  root.append(
    el(
      "div",
      { class: "page-heading" },
      el("h2", { text: "Environments" }),
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
  root.append(el("div", { class: "env-layout" }, list, details));
  return root;
}
function specView(col) {
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
          const result = await api["merge-spec"](
            col.requests,
            imported.requests,
          );
          applySync(col, { ...result, ...imported, requests: result.requests });
        }),
      ),
    ),
  );
  root.append(
    el("p", {
      class: "muted",
      text: "Keep your request collection up to date with an OpenAPI 3.x JSON or YAML specification.",
    }),
    field(
      "Specification URL",
      input(
        col.source,
        (v) => {
          col.source = v;
          mark(col);
        },
        { placeholder: "https://api.example.com/openapi.json" },
      ),
    ),
    button(
      "↻ Synchronize",
      () =>
        action(async () => {
          if (!col.source) throw Error("Enter an OpenAPI URL.");
          status("Synchronizing specification…");
          const result = await api["sync-spec"](col.source, col.requests);
          applySync(col, result);
        }),
      { class: "primary" },
    ),
    el("h2", { text: "Last synchronization" }),
    el("p", {
      class: "muted",
      text: col.lastSync || "No specification synchronized yet.",
    }),
    el("h3", { text: "Your edits stay intact" }),
    el("p", {
      class: "muted",
      text: "New operations are added. Unedited generated fields follow the latest specification; fields you changed are kept. Removed operations remain visible with a warning.",
    }),
  );
  return root;
}
function applySync(col, result) {
  const empty = !col.requests.length;
  col.requests = result.requests;
  if (empty) {
    col.title = result.title;
    if (result.baseUrl) env(col).values.baseUrl = result.baseUrl;
  }
  const n = result.counts || {
    added: result.requests.length,
    updated: 0,
    removed: 0,
  };
  col.lastSync = `${new Date().toLocaleString()} · ${n.added} added · ${n.updated} changed · ${n.removed} removed`;
  mark(col);
  render();
  status(col.lastSync);
}
function runnerView(col) {
  const root = el("div", { class: "view-inner", "data-view": "runner" });
  root.append(
    el(
      "div",
      { class: "page-heading" },
      el("h2", { text: "Collection Runner" }),
      button(
        busy ? "Stop" : "Run Selected Requests",
        () =>
          busy
            ? action(() => {
                stopRun = true;
                return api.cancel();
              })
            : runCollection(col),
        { class: "primary", id: "runSelected" },
      ),
    ),
    el("p", {
      class: "muted",
      text:
        "Requests run in the displayed order using " +
        env(col).name +
        ". Captured variables are available to the next request.",
    }),
    el(
      "div",
      { class: "actions" },
      button("Select all", () => {
        col.requests
          .filter((r) => !r.removed)
          .forEach((r) => runnerSelection.add(col.id + r.id));
        render();
      }),
      button("Clear selection", () => {
        col.requests.forEach((r) => runnerSelection.delete(col.id + r.id));
        render();
      }),
    ),
  );
  col.requests.forEach((r, i) => {
    const result = runnerResults.get(col.id + r.id);
    root.append(
      el(
        "div",
        { class: "run-item" },
        el("input", {
          type: "checkbox",
          checked: runnerSelection.has(col.id + r.id),
          disabled: busy,
          "aria-label": "Select " + r.name,
          onChange: (e) =>
            e.target.checked
              ? runnerSelection.add(col.id + r.id)
              : runnerSelection.delete(col.id + r.id),
        }),
        el("span", { class: "method " + r.method, text: r.method }),
        button(r.name, () => open("request", r.id, col), {
          class: "text-button",
        }),
        button(
          "↑",
          () => {
            if (i) {
              [col.requests[i - 1], col.requests[i]] = [r, col.requests[i - 1]];
              mark(col);
              render();
            }
          },
          { disabled: busy || i === 0, title: "Move earlier" },
        ),
        button(
          "↓",
          () => {
            if (i < col.requests.length - 1) {
              [col.requests[i + 1], col.requests[i]] = [
                col.requests[i],
                col.requests[i + 1],
              ];
              mark(col);
              render();
            }
          },
          {
            disabled: busy || i === col.requests.length - 1,
            title: "Move later",
          },
        ),
        el("span", {
          class:
            "result " +
            (result?.status >= 200 &&
            result?.status < 400 &&
            !result?.tests?.some((t) => !t.passed)
              ? "metrics"
              : "error"),
          text: result
            ? `${result.status || "Error"} · ${result.elapsed} ms${result.tests?.length ? " · " + result.tests.filter((t) => t.passed).length + "/" + result.tests.length + " assertions" : ""}`
            : "",
        }),
      ),
    );
  });
  return root;
}
async function runCollection(col) {
  if (busy) return;
  const selected = structuredClone(
      col.requests.filter((r) => runnerSelection.has(col.id + r.id)),
    ),
    runEnvironment = structuredClone(env(col)),
    runContext = structuredClone(col);
  if (!selected.length) {
    status("Select requests to run.");
    return;
  }
  busy = true;
  stopRun = false;
  render();
  let count = 0;
  try {
    for (const r of selected) {
      if (stopRun) break;
      const result = await sendRequest(runContext, r, true, runEnvironment);
      runnerResults.set(col.id + r.id, result);
      count++;
      render();
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
  );
  root.append(
    el("p", {
      class: "muted",
      text:
        info?.root ||
        "Select an existing local Git repository to share this collection.",
    }),
  );
  if (!info) return root;
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
async function save() {
  await action(async () => {
    await api["workspace-save"](state);
    dirty.clear();
    renderTabs();
    status("Workspace saved locally.");
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
$("newCollection").onclick = () =>
  askName("Create Collection", "", (name) => {
    const col = collection(name);
    state.collections.push(col);
    mark(col);
    open("overview", null, col);
  });
$("openCollection").onclick = () =>
  action(async () => {
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
$("newRequest").onclick = () => newRequest();
$("collectionHome").onclick = () => open("overview");
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
        "Save workspace",
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
  if (key === "s") save();
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
  if (k === "s") save();
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
  if (saved?.collections?.length) {
    state = saved;
    state.collections.forEach(normalize);
    state.selectedEnvironments ||= {};
    state.tabs ||= [];
    state.layout ||= "vertical";
  }
  state.activeCollection ||= state.collections[0].id;
  if (!state.activeTab) open("overview");
  else render();
})();
