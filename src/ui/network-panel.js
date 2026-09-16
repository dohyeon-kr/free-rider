const api = window.client;
const network = {
  entries: [],
  selected: null,
  open: false,
  tab: "response",
  filter: "",
  method: "ALL",
  status: "ALL",
  responseQuery: "",
  collapsedJson: new Set(),
  jar: null,
  message: "",
};

function h(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (key === "class") node.className = value;
    else if (key === "text") node.textContent = value;
    else if (key === "onClick") node.addEventListener("click", value);
    else if (key === "onInput") node.addEventListener("input", value);
    else if (key === "onChange") node.addEventListener("change", value);
    else if (key === "disabled") node.disabled = !!value;
    else if (key === "checked") node.checked = !!value;
    else if (value !== undefined && value !== null) node.setAttribute(key, String(value));
  }
  for (const child of children.flat(Infinity)) {
    if (child === null || child === undefined || child === false) continue;
    node.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return node;
}

function button(text, onClick, attrs = {}) {
  return h("button", { ...attrs, text, onClick });
}

function safeUrl(value) {
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

function requestName(entry) {
  const url = safeUrl(entry.request?.url);
  if (!url) return entry.name || entry.request?.url || "Request";
  return (url.pathname || "/") + url.search;
}

function statusGroup(status) {
  if (!status) return "ERR";
  return `${Math.floor(status / 100)}xx`;
}

function statusClass(status) {
  if (!status) return "network-status-error";
  if (status >= 500) return "network-status-5xx";
  if (status >= 400) return "network-status-4xx";
  if (status >= 300) return "network-status-3xx";
  if (status >= 200) return "network-status-2xx";
  return "";
}

function filteredEntries() {
  const q = network.filter.trim().toLowerCase();
  return network.entries.filter((entry) => {
    const method = String(entry.request?.method || "GET").toUpperCase();
    const status = entry.response?.status || 0;
    if (network.method !== "ALL" && method !== network.method) return false;
    if (network.status !== "ALL" && statusGroup(status) !== network.status) return false;
    if (!q) return true;
    return [
      entry.name,
      entry.collectionTitle,
      entry.request?.url,
      entry.request?.method,
      String(status),
      entry.response?.statusText,
    ]
      .join(" ")
      .toLowerCase()
      .includes(q);
  });
}

function selectedEntry() {
  return network.entries.find((entry) => entry.id === network.selected) || null;
}

function formatBytes(bytes) {
  const n = Number(bytes || 0);
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

function updateNetworkButton() {
  const control = document.getElementById("networkButton");
  if (!control) return;
  control.textContent = `◎ Network${network.entries.length ? ` ${network.entries.length}` : ""}`;
  control.classList.toggle("active", network.open);
}

function quoteShell(value) {
  return `'${String(value).replaceAll("'", `'"'"'`)}'`;
}

function curlFor(entry) {
  const request = entry.request || {};
  const lines = ["curl", "-X", String(request.method || "GET").toUpperCase(), quoteShell(request.url || "")];
  for (const [key, value] of Object.entries(request.headers || {}))
    lines.push("-H", quoteShell(`${key}: ${value}`));
  const body = request.body;
  if (body && typeof body === "object" && body.__freeRiderMultipart === 1) {
    for (const part of body.parts || []) {
      if (part.kind === "file") lines.push("-F", quoteShell(`${part.key}=@${part.name || "file"}`));
      else lines.push("-F", quoteShell(`${part.key}=${part.value ?? ""}`));
    }
  } else if (body !== undefined && body !== null && String(body) !== "") {
    lines.push("--data-raw", quoteShell(String(body)));
  }
  return lines.join(" \\\n  ");
}

function copy(text, message = "복사했습니다.") {
  api.copy(text).then(() => {
    network.message = message;
    renderPanel();
  }).catch((error) => {
    network.message = error.message;
    renderPanel();
  });
}

function headerTable(headers) {
  const rows = Object.entries(headers || {}).sort(([a], [b]) => a.localeCompare(b));
  if (!rows.length) return h("p", { class: "network-empty", text: "헤더가 없습니다." });
  return h(
    "table",
    { class: "network-kv" },
    h("tbody", {}, rows.map(([key, value]) =>
      h("tr", {}, h("th", { text: key }), h("td", { text: String(value) })),
    )),
  );
}

function cookieTable(cookies) {
  if (!cookies?.length) return h("p", { class: "network-empty", text: "쿠키가 없습니다." });
  return h(
    "div",
    { class: "network-cookie-scroll" },
    h(
      "table",
      { class: "network-cookie-table" },
      h("thead", {}, h("tr", {}, ["Name", "Value", "Domain", "Path", "Flags"].map((label) => h("th", { text: label })))),
      h("tbody", {}, cookies.map((cookie) => {
        const flags = [
          cookie.httpOnly ? "HttpOnly" : "",
          cookie.secure ? "Secure" : "",
          cookie.sameSite && cookie.sameSite !== "unspecified" ? `SameSite=${cookie.sameSite}` : "",
          cookie.session ? "Session" : "",
        ].filter(Boolean).join(" · ");
        return h("tr", {},
          h("td", { text: cookie.name || "" }),
          h("td", { class: "network-cookie-value", text: cookie.value || "" }),
          h("td", { text: cookie.domain || "" }),
          h("td", { text: cookie.path || "/" }),
          h("td", { text: flags }),
        );
      })),
    ),
  );
}

function jsonPath(parent, key, array) {
  if (array) return `${parent}[${key}]`;
  return /^[A-Za-z_$][\w$]*$/.test(String(key))
    ? `${parent}.${key}`
    : `${parent}[${JSON.stringify(String(key))}]`;
}

function jsonMatches(value, path, key, query) {
  if (!query) return true;
  const q = query.toLowerCase();
  if (`${path} ${key ?? ""}`.toLowerCase().includes(q)) return true;
  if (value && typeof value === "object") {
    return Object.entries(value).some(([childKey, child]) =>
      jsonMatches(child, jsonPath(path, childKey, Array.isArray(value)), childKey, q),
    );
  }
  return String(value).toLowerCase().includes(q);
}

function jsonValue(value) {
  if (typeof value === "string") return JSON.stringify(value);
  if (value === null) return "null";
  return String(value);
}

function jsonTree(value, path = "$", key = null, query = "") {
  if (!jsonMatches(value, path, key, query)) return null;
  const object = value !== null && typeof value === "object";
  const row = h("div", { class: "network-json-row" });
  if (object) {
    const collapsed = network.collapsedJson.has(path) && !query;
    row.append(
      button(collapsed ? "›" : "⌄", () => {
        collapsed ? network.collapsedJson.delete(path) : network.collapsedJson.add(path);
        renderPanel();
      }, { class: "network-json-toggle", title: collapsed ? "펼치기" : "접기" }),
      h("span", { class: "network-json-key", text: key === null ? "$" : String(key) }),
      h("span", { class: "network-json-meta", text: Array.isArray(value) ? `[${value.length}]` : `{${Object.keys(value).length}}` }),
      button("⎘", () => copy(path, `${path} JSONPath를 복사했습니다.`), { class: "network-json-copy", title: `Copy JSONPath · ${path}` }),
    );
    const children = h("div", { class: "network-json-children" });
    if (!collapsed || query) {
      for (const [childKey, child] of Object.entries(value)) {
        const childPath = jsonPath(path, childKey, Array.isArray(value));
        const childNode = jsonTree(child, childPath, childKey, query);
        if (childNode) children.append(childNode);
      }
    }
    return h("div", { class: "network-json-node" }, row, children);
  }
  row.append(
    h("span", { class: "network-json-spacer" }),
    h("span", { class: "network-json-key", text: key === null ? "$" : String(key) }),
    h("span", { class: `network-json-value ${typeof value}`, text: jsonValue(value) }),
    button("⎘", () => copy(path, `${path} JSONPath를 복사했습니다.`), { class: "network-json-copy", title: `Copy JSONPath · ${path}` }),
  );
  return row;
}

function highlightedText(text, query) {
  const pre = h("pre", { class: "network-code" });
  if (!query) {
    pre.textContent = text;
    return pre;
  }
  const source = String(text);
  const lower = source.toLowerCase();
  const needle = query.toLowerCase();
  let from = 0;
  let index;
  while ((index = lower.indexOf(needle, from)) !== -1) {
    pre.append(document.createTextNode(source.slice(from, index)));
    pre.append(h("mark", { text: source.slice(index, index + needle.length) }));
    from = index + needle.length;
  }
  pre.append(document.createTextNode(source.slice(from)));
  return pre;
}

function bodyInspector(body, query = "") {
  if (body && typeof body === "object") return h("div", { class: "network-json-tree" }, jsonTree(body, "$", null, query));
  const text = String(body || "");
  try {
    const parsed = JSON.parse(text);
    return h("div", { class: "network-json-tree" }, jsonTree(parsed, "$", null, query));
  } catch {
    return highlightedText(text, query);
  }
}

function detailHeaders(entry) {
  return h("div", { class: "network-detail-section" },
    h("h3", { text: "General" }),
    headerTable({
      "Request URL": entry.request?.url || "",
      "Request Method": entry.request?.method || "",
      "Status Code": `${entry.response?.status || "Error"} ${entry.response?.statusText || ""}`.trim(),
    }),
    h("h3", { text: "Request Headers" }),
    headerTable(entry.request?.headers),
    h("h3", { text: "Response Headers" }),
    headerTable(entry.response?.headers),
  );
}

function detailRequest(entry) {
  return h("div", { class: "network-detail-section" },
    h("div", { class: "network-inline-actions" },
      button("Copy URL", () => copy(entry.request?.url || "", "URL을 복사했습니다.")),
      button("Copy cURL", () => copy(curlFor(entry), "cURL을 복사했습니다.")),
    ),
    h("h3", { text: "Request Body" }),
    entry.request?.body ? bodyInspector(entry.request.body) : h("p", { class: "network-empty", text: "요청 본문이 없습니다." }),
  );
}

function detailResponse(entry) {
  const input = h("input", {
    class: "network-response-search",
    type: "search",
    placeholder: "응답 검색",
    value: network.responseQuery,
    onInput: (event) => {
      network.responseQuery = event.target.value;
      renderPanel();
      const next = document.querySelector(".network-response-search");
      next?.focus();
      next?.setSelectionRange(network.responseQuery.length, network.responseQuery.length);
    },
  });
  const body = entry.response?.body || "";
  let parsed = null;
  try { parsed = typeof body === "string" ? JSON.parse(body) : body; } catch {}
  return h("div", { class: "network-detail-section" },
    h("div", { class: "network-response-tools" },
      input,
      parsed && typeof parsed === "object" ? button("모두 접기", () => {
        const collect = (value, path = "$" ) => {
          if (!value || typeof value !== "object") return;
          network.collapsedJson.add(path);
          for (const [key, child] of Object.entries(value)) collect(child, jsonPath(path, key, Array.isArray(value)));
        };
        collect(parsed);
        renderPanel();
      }) : null,
      parsed && typeof parsed === "object" ? button("모두 펼치기", () => {
        network.collapsedJson.clear();
        renderPanel();
      }) : null,
      button("Copy", () => copy(body, "응답 본문을 복사했습니다.")),
    ),
    entry.response?.bodyTruncated ? h("p", { class: "network-warning", text: "히스토리에는 응답 본문 앞 512KB만 보관됩니다." }) : null,
    bodyInspector(body, network.responseQuery.trim()),
  );
}

function detailCookies(entry) {
  return h("div", { class: "network-detail-section" },
    h("h3", { text: "Request Cookies" }),
    cookieTable(entry.cookies?.request || []),
    h("h3", { text: "Set-Cookie" }),
    entry.cookies?.setCookie?.length
      ? h("pre", { class: "network-code", text: entry.cookies.setCookie.join("\n") })
      : h("p", { class: "network-empty", text: "이 응답의 Set-Cookie 헤더가 없습니다." }),
    h("h3", { text: "Cookie Jar after response" }),
    cookieTable(entry.cookies?.current || []),
  );
}

function detailTiming(entry) {
  const timing = entry.timing || {};
  const total = Math.max(1, Number(timing.total || entry.response?.elapsed || 0));
  const waiting = Math.max(0, Number(timing.waiting || 0));
  const download = Math.max(0, Number(timing.download || 0));
  const waitBar = h("span", { class: "network-waterfall-wait" });
  waitBar.style.width = `${Math.min(100, waiting / total * 100)}%`;
  const downloadBar = h("span", { class: "network-waterfall-download" });
  downloadBar.style.width = `${Math.min(100, download / total * 100)}%`;
  return h("div", { class: "network-detail-section" },
    h("h3", { text: "Timing" }),
    h("div", { class: "network-timing-row" }, h("span", { text: "Waiting (TTFB)" }), h("strong", { text: `${waiting} ms` })),
    h("div", { class: "network-timing-row" }, h("span", { text: "Content Download" }), h("strong", { text: `${download} ms` })),
    h("div", { class: "network-timing-row" }, h("span", { text: "Network Total" }), h("strong", { text: `${timing.total ?? entry.response?.elapsed ?? 0} ms` })),
    h("div", { class: "network-timing-row" }, h("span", { text: "Request Total + scripts" }), h("strong", { text: `${entry.response?.elapsed || 0} ms` })),
    h("div", { class: "network-waterfall" }, waitBar, downloadBar),
    h("div", { class: "network-waterfall-legend" }, h("span", { text: "Waiting" }), h("span", { text: "Download" })),
  );
}

function renderDetail(entry) {
  if (!entry) return h("div", { class: "network-detail-empty", text: "요청을 선택하면 Headers, Response, Cookies, Timing을 볼 수 있습니다." });
  const tabs = [
    ["headers", "Headers"],
    ["request", "Request"],
    ["response", "Response"],
    ["cookies", "Cookies"],
    ["timing", "Timing"],
  ];
  const content = {
    headers: () => detailHeaders(entry),
    request: () => detailRequest(entry),
    response: () => detailResponse(entry),
    cookies: () => detailCookies(entry),
    timing: () => detailTiming(entry),
  }[network.tab]();
  return h("div", { class: "network-detail" },
    h("div", { class: "network-detail-head" },
      h("div", {},
        h("strong", { text: entry.name || requestName(entry) }),
        h("span", { class: "network-detail-url", text: entry.request?.url || "" }),
      ),
      h("div", { class: "network-inline-actions" },
        button("다시 실행", async () => {
          try {
            network.message = "재실행 중…";
            renderPanel();
            await api["network-replay"](entry.id);
            network.message = "재실행했습니다.";
          } catch (error) {
            network.message = error.message;
          }
          renderPanel();
        }, { disabled: !entry.replayable }),
        button("Copy cURL", () => copy(curlFor(entry), "cURL을 복사했습니다.")),
      ),
    ),
    h("div", { class: "network-detail-tabs" }, tabs.map(([id, label]) =>
      button(label, () => {
        network.tab = id;
        network.responseQuery = "";
        renderPanel();
      }, { class: network.tab === id ? "active" : "" }),
    )),
    h("div", { class: "network-detail-body" }, content),
  );
}

function renderJar() {
  if (!network.jar) return null;
  return h("div", { class: "network-jar-overlay" },
    h("div", { class: "network-jar" },
      h("div", { class: "network-jar-head" },
        h("div", {}, h("strong", { text: "Cookie Jar" }), h("span", { text: `${network.jar.length} cookies` })),
        h("div", { class: "network-inline-actions" },
          button("모두 삭제", async () => {
            await api["cookie-clear"]();
            network.jar = [];
            network.message = "Cookie Jar를 비웠습니다.";
            renderPanel();
          }),
          button("닫기", () => { network.jar = null; renderPanel(); }),
        ),
      ),
      cookieTable(network.jar),
    ),
  );
}

function renderPanel() {
  updateNetworkButton();
  const root = document.getElementById("networkDrawer");
  if (!root) return;
  root.hidden = !network.open;
  if (!network.open) return;
  const entries = filteredEntries();
  if (network.selected && !network.entries.some((entry) => entry.id === network.selected)) network.selected = null;
  root.replaceChildren(
    h("div", { class: "network-toolbar" },
      h("strong", { text: "● Network" }),
      h("input", {
        type: "search",
        placeholder: "URL, 이름, 상태 검색",
        value: network.filter,
        onInput: (event) => {
          network.filter = event.target.value;
          renderPanel();
          const next = document.querySelector("#networkDrawer .network-toolbar input[type=search]");
          next?.focus();
          next?.setSelectionRange(network.filter.length, network.filter.length);
        },
      }),
      h("select", { onChange: (event) => { network.method = event.target.value; renderPanel(); } },
        ["ALL", "GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"].map((value) =>
          h("option", { value, text: value === "ALL" ? "All methods" : value, selected: network.method === value ? "selected" : null }),
        ),
      ),
      h("select", { onChange: (event) => { network.status = event.target.value; renderPanel(); } },
        ["ALL", "2xx", "3xx", "4xx", "5xx", "ERR"].map((value) =>
          h("option", { value, text: value === "ALL" ? "All status" : value, selected: network.status === value ? "selected" : null }),
        ),
      ),
      h("span", { class: "network-count", text: `${entries.length}/${network.entries.length}` }),
      button("Cookie Jar", async () => {
        try {
          network.jar = await api["cookie-jar"]();
        } catch (error) {
          network.message = error.message;
        }
        renderPanel();
      }),
      button("Clear", async () => {
        await api["network-clear"]();
        network.entries = [];
        network.selected = null;
        network.message = "네트워크 히스토리를 지웠습니다.";
        renderPanel();
      }),
      button("×", () => { network.open = false; renderPanel(); }, { class: "network-close", title: "Close Network" }),
    ),
    network.message ? h("div", { class: "network-message", text: network.message }) : null,
    h("div", { class: "network-columns" },
      h("div", { class: "network-list" },
        h("div", { class: "network-row network-list-head" },
          h("span", { text: "Method" }),
          h("span", { text: "Status" }),
          h("span", { text: "Name" }),
          h("span", { text: "Size" }),
          h("span", { text: "Time" }),
        ),
        entries.length ? entries.map((entry) => {
          const status = entry.response?.status || 0;
          return h("button", {
            class: `network-row network-entry ${network.selected === entry.id ? "selected" : ""}`,
            title: entry.request?.url || "",
            onClick: () => {
              network.selected = entry.id;
              network.tab = "response";
              network.responseQuery = "";
              renderPanel();
            },
          },
            h("span", { class: `network-method ${String(entry.request?.method || "GET").toLowerCase()}`, text: entry.request?.method || "GET" }),
            h("span", { class: statusClass(status), text: status || "ERR" }),
            h("span", { class: "network-name" },
              h("strong", { text: requestName(entry) }),
              h("small", { text: `${entry.collectionTitle || "Local"} · ${new Date(entry.at).toLocaleTimeString()}` }),
            ),
            h("span", { text: formatBytes(entry.response?.bytes) }),
            h("span", { text: `${entry.response?.elapsed || 0} ms` }),
          );
        }) : h("div", { class: "network-empty-list", text: network.entries.length ? "필터와 일치하는 요청이 없습니다." : "요청을 보내면 Network 기록이 여기에 쌓입니다." }),
      ),
      renderDetail(selectedEntry()),
    ),
    renderJar(),
  );
}

function install() {
  const toolbar = document.querySelector(".toolbar-actions");
  if (toolbar && !document.getElementById("networkButton")) {
    const control = button("◎ Network", () => {
      network.open = !network.open;
      if (network.open && !network.selected && network.entries[0]) network.selected = network.entries[0].id;
      renderPanel();
    }, { id: "networkButton", title: "Network history" });
    toolbar.insertBefore(control, toolbar.firstChild);
  }
  if (!document.getElementById("networkDrawer")) document.body.append(h("section", { id: "networkDrawer", class: "network-drawer", hidden: "hidden", "aria-label": "Network history" }));
  api["network-history"]().then((entries) => {
    network.entries = Array.isArray(entries) ? entries.slice(0, 200) : [];
    updateNetworkButton();
  }).catch((error) => {
    network.message = error.message;
  });
  api.onNetworkEntry((entry) => {
    network.entries = [entry, ...network.entries.filter((item) => item.id !== entry.id)].slice(0, 200);
    if (network.open) network.selected = entry.id;
    renderPanel();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && network.open && !document.querySelector("dialog[open]")) {
      network.open = false;
      renderPanel();
    }
  });
  renderPanel();
}

Promise.resolve(window.appReady).catch(() => {}).finally(install);
