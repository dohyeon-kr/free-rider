const $ = (id) => document.getElementById(id),
  api = window.client;
let state = {
    version: 1,
    title: "My API collection",
    source: "",
    requests: [],
    environments: [
      {
        id: "local",
        name: "Local",
        values: { baseUrl: "http://localhost:3000" },
      },
    ],
  },
  selected = null,
  lastResponse = null,
  busy = false,
  envIndex = 0;
const blank = () => ({
  id: crypto.randomUUID(),
  name: "New request",
  group: "My requests",
  method: "GET",
  url: "{{baseUrl}}/",
  query: {},
  headers: {},
  body: "",
  auth: false,
  extract: {},
  manual: true,
});
const current = () => state.requests.find((r) => r.id === selected);
function status(message) {
  $("status").textContent = message;
}
async function action(fn) {
  try {
    await fn();
  } catch (e) {
    status(e.message);
  }
}
function json(id) {
  const value = JSON.parse($(id).value || "{}");
  if (!value || Array.isArray(value) || typeof value !== "object")
    throw Error(`${id}: JSON 객체를 입력하세요.`);
  return value;
}
function capture() {
  const r = current();
  if (!r) return;
  Object.assign(r, {
    name: $("name").value,
    method: $("method").value,
    url: $("url").value,
    query: json("query"),
    headers: json("headers"),
    body: $("body").value,
    auth: $("auth").checked,
    extract: json("extract"),
  });
  state.source = $("source").value.trim();
}
function list() {
  const nav = $("requests");
  nav.replaceChildren();
  const query = $("search").value.toLowerCase();
  const groups = new Map();
  for (const r of state.requests) {
    if (!`${r.name} ${r.url} ${r.method}`.toLowerCase().includes(query))
      continue;
    const g = r.group || "General";
    if (!groups.has(g)) groups.set(g, []);
    groups.get(g).push(r);
  }
  for (const [group, requests] of groups) {
    const title = document.createElement("div");
    title.className = "group";
    title.textContent = group;
    nav.append(title);
    for (const r of requests) {
      const b = document.createElement("button");
      b.className = r.id === selected ? "selected" : "";
      const m = document.createElement("b");
      m.textContent = r.method;
      m.className = r.method;
      const n = document.createElement("span");
      n.textContent = (r.removed ? "⚠ " : "") + r.name;
      b.append(m, n);
      b.onclick = () =>
        action(async () => {
          capture();
          selected = r.id;
          render();
        });
      nav.append(b);
    }
  }
}
function render() {
  list();
  $("collectionTitle").textContent = state.title;
  $("source").value = state.source;
  const r = current();
  if (!r) return;
  for (const k of ["name", "method", "url", "body"]) $(k).value = r[k] || "";
  for (const k of ["query", "headers", "extract"])
    $(k).value = JSON.stringify(r[k] || {}, null, 2);
  $("auth").checked = !!r.auth;
  $("description").textContent = r.description || "";
  $("removed").textContent = r.removed ? "명세에서 제거됨 · 요청은 보존됨" : "";
  $("environmentLabel").textContent = "● " + state.environments[envIndex].name;
}
function ensureSelection() {
  if (!state.requests.length) state.requests.push(blank());
  if (!state.requests.some((r) => r.id === selected))
    selected = state.requests[0].id;
}
$("new").onclick = () =>
  action(async () => {
    capture();
    const r = blank();
    state.requests.push(r);
    selected = r.id;
    render();
  });
$("search").oninput = list;
for (const b of document.querySelectorAll("[data-tab]"))
  b.onclick = () => {
    for (const other of document.querySelectorAll("[data-tab]")) {
      other.classList.toggle("active", other === b);
      $(other.dataset.tab + "Panel").hidden = other !== b;
    }
  };
$("import").onclick = () =>
  action(async () => {
    capture();
    const result = await api["import-spec"]();
    if (!result) return;
    const merged = await api["merge-spec"](state.requests, result.requests);
    state.requests = merged.requests;
    state.title = result.title;
    if (result.baseUrl)
      state.environments[envIndex].values.baseUrl = result.baseUrl;
    ensureSelection();
    render();
    status(`명세 가져옴: ${result.requests.length}개 요청`);
  });
$("sync").onclick = () =>
  action(async () => {
    capture();
    if (!state.source) throw Error("OpenAPI 명세 URL을 입력하세요.");
    $("sync").disabled = true;
    try {
      const result = await api["sync-spec"](state.source, state.requests);
      state.requests = result.requests;
      state.title = result.title;
      const c = result.counts;
      $("syncInfo").textContent =
        `+${c.added} 추가 · ${c.updated} 변경 · ${c.removed} 제거\n직접 수정한 값은 보존했습니다.`;
      ensureSelection();
      render();
      status("명세 동기화 완료");
    } finally {
      $("sync").disabled = false;
    }
  });
$("send").onclick = () =>
  action(async () => {
    if (busy) return;
    capture();
    busy = true;
    $("send").disabled = true;
    $("cancel").hidden = false;
    status("요청 실행 중…");
    $("metrics").textContent = "RUNNING";
    lastResponse = null;
    $("response").textContent = "응답을 기다리고 있습니다…";
    try {
      const result = await api.send(current(), state.environments[envIndex]);
      lastResponse = result;
      $("metrics").textContent =
        `${result.status} ${result.statusText}   ·   ${result.elapsed} ms   ·   ${result.bytes.toLocaleString()} B`;
      showResponse("body");
      status(
        result.variables.length
          ? `성공 · ${result.variables.join(", ")} 환경변수 추출 완료`
          : "요청 완료",
      );
    } catch (e) {
      $("metrics").textContent = "ERROR";
      $("response").textContent = e.message;
      throw e;
    } finally {
      busy = false;
      $("send").disabled = false;
      $("cancel").hidden = true;
    }
  });
$("cancel").onclick = () => action(() => api.cancel());
function showResponse(part) {
  if (!lastResponse) return;
  let text = lastResponse[part];
  if (part === "body") {
    try {
      text = JSON.stringify(JSON.parse(text), null, 2);
    } catch {}
  } else text = JSON.stringify(text, null, 2);
  $("response").textContent = text;
}
$("responseBody").onclick = () => showResponse("body");
$("responseHeaders").onclick = () => showResponse("headers");
$("open").onclick = () =>
  action(async () => {
    if (busy) throw Error("실행 중인 요청이 끝난 후 열어주세요.");
    const result = await api["open-collection"]();
    if (!result) return;
    state = result;
    envIndex = 0;
    ensureSelection();
    render();
    lastResponse = null;
    $("response").textContent = "컬렉션을 불러왔습니다.";
    status("컬렉션 열기 완료");
  });
$("save").onclick = () =>
  action(async () => {
    capture();
    $("saveDialog").showModal();
  });
$("cancelSave").onclick = () => $("saveDialog").close();
function shared() {
  const copy = structuredClone(state);
  copy.environments = copy.environments.map((e) => ({
    ...e,
    values: Object.fromEntries(
      Object.keys(e.values)
        .sort()
        .map((k) => [k, ""]),
    ),
  }));
  return copy;
}
$("confirmSave").onclick = () =>
  action(async () => {
    if (await api["save-collection"](shared()))
      status("컬렉션 저장 완료 · 환경변수 값 제외");
    $("saveDialog").close();
  });
function envOptions() {
  const select = $("environment");
  select.replaceChildren();
  state.environments.forEach((e, i) => {
    const o = document.createElement("option");
    o.value = i;
    o.textContent = e.name;
    select.append(o);
  });
  select.value = envIndex;
  $("envValues").value = JSON.stringify(
    state.environments[envIndex].values,
    null,
    2,
  );
}
$("envButton").onclick = () => {
  envOptions();
  $("environments").showModal();
};
$("closeEnv").onclick = () => $("environments").close();
$("environment").onchange = () => {
  envIndex = Number($("environment").value);
  envOptions();
  render();
};
$("addEnv").onclick = () => {
  const count = state.environments.length + 1;
  state.environments.push({
    id: crypto.randomUUID(),
    name: `Environment ${count}`,
    values: { baseUrl: "" },
  });
  envIndex = state.environments.length - 1;
  envOptions();
};
$("applyEnv").onclick = () =>
  action(async () => {
    state.environments[envIndex].values = json("envValues");
    $("environments").close();
    render();
    status("환경변수 적용 완료");
  });
$("importEnv").onclick = () =>
  action(async () => {
    const values = await api["import-env"]();
    if (values)
      $("envValues").value = JSON.stringify(
        { ...json("envValues"), ...values },
        null,
        2,
      );
  });
$("clearTokens").onclick = () =>
  action(async () => {
    await api["clear-tokens"]();
    status("인증 토큰 삭제 완료");
  });
document.addEventListener("keydown", (e) => {
  if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
    e.preventDefault();
    $("send").click();
  }
  if ((e.metaKey || e.ctrlKey) && e.key === "s") {
    e.preventDefault();
    $("save").click();
  }
});
ensureSelection();
render();
$("gitButton").onclick = () => $("gitDialog").showModal();
$("closeGit").onclick = () => $("gitDialog").close();
function gitStatus(r) {
  if (r)
    $("gitStatus").textContent =
      `${r.root}\n${r.branch}\n\n${r.status || "변경 사항 없음"}`;
}
$("gitOpen").onclick = () =>
  action(async () => gitStatus(await api["git-open"]()));
$("gitSave").onclick = () =>
  action(async () => {
    capture();
    gitStatus(await api["git-save"](shared()));
    status("저장소에 컬렉션 저장 완료");
  });
$("gitDiff").onclick = () =>
  action(async () => {
    $("gitStatus").textContent =
      (await api["git-diff"]()) ||
      "추적 중인 파일에 변경 사항이 없습니다. 새 파일은 Git 상태에서 확인하세요.";
  });
$("gitCommit").onclick = () =>
  action(async () => {
    gitStatus(await api["git-commit"]($("commitMessage").value));
    status("컬렉션 커밋 완료");
  });
