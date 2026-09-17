import { readFile, writeFile } from "node:fs/promises";

async function edit(path, transform) {
  const before = await readFile(path, "utf8");
  const after = transform(before);
  if (after === before) throw new Error(`No changes produced for ${path}`);
  await writeFile(path, after);
}

function replaceOnce(text, from, to, label) {
  const index = text.indexOf(from);
  if (index < 0) throw new Error(`Missing pattern: ${label}`);
  if (text.indexOf(from, index + from.length) >= 0)
    throw new Error(`Pattern is not unique: ${label}`);
  return text.slice(0, index) + to + text.slice(index + from.length);
}

function replaceAllRequired(text, from, to, expected, label) {
  const count = text.split(from).length - 1;
  if (count !== expected)
    throw new Error(`Expected ${expected} matches for ${label}, found ${count}`);
  return text.split(from).join(to);
}

await edit("src/ui/model.js", (text) => {
  text = replaceOnce(
    text,
    '    authConfig: { type: "none" },\n    environments:',
    '    authConfig: { type: "none" },\n    interceptors: { enabled: false, before: "", after: "" },\n    environments:',
    "new collection interceptors",
  );
  text = replaceOnce(
    text,
    '  c.authConfig ||= { type: "none" };\n  c.environments?.forEach',
    '  c.authConfig ||= { type: "none" };\n  c.interceptors ||= { enabled: false, before: "", after: "" };\n  c.interceptors.enabled = !!c.interceptors.enabled;\n  c.interceptors.before ||= "";\n  c.interceptors.after ||= "";\n  c.environments?.forEach',
    "normalize collection interceptors",
  );
  return text;
});

await edit("src/ui/app.js", (text) => {
  text = replaceOnce(
    text,
    '    button("OpenAPI", () => {\n      $("dialog").close();\n      open("spec", null, col);\n    }),',
    '    button("Interceptors", () => {\n      $("dialog").close();\n      open("scripts", null, col);\n    }),\n    button("OpenAPI", () => {\n      $("dialog").close();\n      open("spec", null, col);\n    }),',
    "collection menu interceptors",
  );
  text = replaceOnce(
    text,
    '    scripts: "전역 전후처리",',
    '    scripts: "⚡ Interceptors",',
    "interceptor tab title",
  );
  text = replaceOnce(
    text,
    '    [\n      "♧",\n      "OpenAPI",\n      col.source || "No specification URL connected",',
    '    [\n      "⚡",\n      "Interceptors",\n      col.interceptors?.enabled\n        ? "Enabled for this collection"\n        : "Disabled",\n      "Configure interceptors",\n      () => open("scripts", null, col),\n    ],\n    [\n      "♧",\n      "OpenAPI",\n      col.source || "No specification URL connected",',
    "overview interceptor entry",
  );
  text = replaceOnce(
    text,
    '    scripts: () => scriptsView(),',
    '    scripts: () => scriptsView(col),',
    "collection-scoped interceptor view",
  );
  text = replaceOnce(
    text,
    '  fixedScripts = null,',
    '  fixedInterceptors = null,',
    "send request fixed interceptors",
  );
  text = replaceOnce(
    text,
    '    result = await api.send(ready, environment, col, structuredClone(fixedScripts || state.globalScripts || {}));',
    '    result = await api.send(ready, environment, col, structuredClone(fixedInterceptors || col.interceptors || {}));',
    "send collection interceptors",
  );

  const scriptsView = /function scriptsView\(\) \{[\s\S]*?\n\}\nfunction environments\(col\) \{/;
  if (!scriptsView.test(text)) throw new Error("Missing scriptsView function");
  text = text.replace(
    scriptsView,
    `function scriptsView(col) {
  const interceptors = col.interceptors ||= {enabled:false,before:"",after:""};
  const root=el("div",{class:"view-inner","data-view":"scripts"});
  root.append(el("h2",{text:"Collection Interceptors"}),
    el("p",{class:"muted",text:"이 컬렉션의 단일 요청과 컬렉션 실행에만 적용합니다. Before Request는 전송 직전, After Response는 응답 수신 뒤 실행합니다."}),
    el("label",{},el("input",{type:"checkbox",checked:interceptors.enabled,onChange:e=>{interceptors.enabled=e.target.checked;mark(col);}})," 활성화"),
    field("Before Request · req, ctx",textarea(interceptors.before,v=>{interceptors.before=v;mark(col);},{"aria-label":"Before Request Interceptor",placeholder:'req.headers.set("Authorization", "Bearer " + ctx.vars.get("accessToken"));'})),
    field("After Response · req, res, ctx",textarea(interceptors.after,v=>{interceptors.after=v;mark(col);},{"aria-label":"After Response Interceptor",placeholder:'if (res.status === 200) ctx.vars.set("accessToken", res.json().accessToken);'})),
    el("pre",{class:"code-block",text:\`req.method / req.url / req.body
req.headers.get / set / delete
res.status / res.headers.get / res.text() / res.json()
ctx.env.get("KEY")
ctx.vars.get / set / delete
ctx.log("실행 로그")\`}),
    button("저장",()=>save(),{class:"primary"}),
    el("p",{class:"hint",text:"Interceptor 로그는 요청의 콘솔에서 확인합니다. 파일·셸·직접 네트워크 API는 제공하지 않습니다."}));
  return root;
}
function environments(col) {`,
  );

  text = replaceOnce(
    text,
    '    runScripts = structuredClone(state.globalScripts || {});',
    '    runInterceptors = structuredClone(col.interceptors || {});',
    "runner interceptor snapshot",
  );
  text = replaceOnce(
    text,
    '      const result = await sendRequest(runContext, r, true, runEnvironment, runScripts);',
    '      const result = await sendRequest(runContext, r, true, runEnvironment, runInterceptors);',
    "runner interceptor send",
  );

  const oldCreate = `$("newCollection").onclick = () =>
  askName("Create Collection", "", (name) => {
    const col = collection(name);
    state.collections.push(col);
    mark(col);
    open("overview", null, col);
  });`;
  const newCreate = `function addCollection(col, kind = "overview") {
  state.collections.push(col);
  mark(col);
  open(kind, null, col);
}
function startBlankCollection() {
  askName("Create Collection", "", (name) => addCollection(collection(name)));
}
function startOpenApiCollection() {
  let source = "";
  modal(
    "OpenAPI로 시작하기",
    el(
      "div",
      {},
      el("p", { class: "muted", text: "OpenAPI 3.x 파일 또는 URL에서 새 컬렉션을 시작합니다." }),
      field(
        "Specification URL",
        input(source, (value) => (source = value), {
          placeholder: "https://api.example.com/openapi.json",
        }),
      ),
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
      const result = await api["sync-spec"](source, []);
      const col = collection(result.title || "OpenAPI Collection");
      col.source = source;
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
$("newCollection").onclick = newCollectionFlow;`;
  text = replaceOnce(text, oldCreate, newCreate, "new collection flow");

  text = replaceOnce(
    text,
    '      state = saved;\n      state.collections.forEach(normalize);\n      state.selectedEnvironments ||= {};\n      state.tabs ||= [];',
    '      state = saved;\n      const legacyInterceptors = state.globalScripts;\n      state.collections.forEach((col) => {\n        if (!col.interceptors && legacyInterceptors)\n          col.interceptors = structuredClone(legacyInterceptors);\n        normalize(col);\n      });\n      delete state.globalScripts;\n      state.selectedEnvironments ||= {};\n      state.tabs ||= [];',
    "legacy global interceptor migration",
  );
  return text;
});

await edit("src/index.html", (text) => {
  const from = `        <button id="scriptsButton" class="sidebar-bottom">전역 전후처리</button>
        <button id="specButton" class="sidebar-bottom">
          명세 연결 <span>＋</span>
        </button>`;
  const to = `        <button id="scriptsButton" hidden aria-hidden="true">Interceptors</button>
        <button id="specButton" hidden aria-hidden="true">OpenAPI</button>`;
  return replaceOnce(text, from, to, "hide global collection settings shortcuts");
});

await edit("src/main.cjs", (text) => {
  text = replaceOnce(
    text,
    "async function runRequest(request, environment, collection, scripts) {",
    "async function runRequest(request, environment, collection, interceptors) {",
    "runRequest interceptor argument",
  );
  text = replaceOnce(
    text,
    "      scripts,\n      environment.values,",
    "      interceptors,\n      environment.values,",
    "execute interceptors",
  );
  text = replaceAllRequired(
    text,
    "publishNetworkEntry(entry, structuredClone({ request, environment, collection, scripts }));",
    "publishNetworkEntry(entry, structuredClone({ request, environment, collection, interceptors }));",
    2,
    "network replay interceptors",
  );
  text = replaceOnce(
    text,
    'handle("send", (request, environment, collection, scripts) =>\n  runRequest(request, environment, collection, scripts),',
    'handle("send", (request, environment, collection, interceptors) =>\n  runRequest(request, environment, collection, interceptors || collection?.interceptors || {}),',
    "send handler interceptors",
  );
  text = replaceOnce(
    text,
    "    structuredClone(replay.scripts),",
    "    structuredClone(replay.interceptors || replay.scripts || replay.collection?.interceptors || {}),",
    "network replay legacy interceptor fallback",
  );
  return text;
});

await edit("src/modules/runner/index.cjs", (text) => {
  text = replaceOnce(
    text,
    "async function execute(request, variables, signal, scripts = {}, environment = variables, resolveFile, fetcher = fetch) {",
    "async function execute(request, variables, signal, interceptors = {}, environment = variables, resolveFile, fetcher = fetch) {",
    "runner interceptor argument",
  );
  text = replaceAllRequired(text, "if(scripts.enabled)", "if(interceptors.enabled)", 2, "interceptor enabled checks");
  text = replaceOnce(text, "runScript(scripts.before", "runScript(interceptors.before", "before interceptor source");
  text = replaceOnce(text, "runScript(scripts.after", "runScript(interceptors.after", "after interceptor source");
  text = replaceOnce(text, 'throw Error("전처리: "+error.message);', 'throw Error("Before Request interceptor: "+error.message);', "before interceptor error");
  text = replaceOnce(text, 'scriptError="후처리: "+error.message;', 'scriptError="After Response interceptor: "+error.message;', "after interceptor error");
  return text;
});

await edit("src/smoke.cjs", (text) => {
  text = replaceOnce(
    text,
    '  await js(`document.querySelector(\'#newCollection\').click(); document.querySelector(\'#dialogCancel\').click()`);',
    '  await js(`document.querySelector(\'#newCollection\').click(); if (![...document.querySelectorAll(\'#dialogContent button\')].some(b=>b.textContent===\'OpenAPI로 시작하기\')) throw new Error(\'OpenAPI collection start option missing\'); document.querySelector(\'#dialogCancel\').click()`);',
    "smoke OpenAPI create option",
  );
  text = replaceOnce(
    text,
    '  await js(`document.querySelector(\'#scriptsButton\').click(); const view=document.querySelector(\'[data-view=scripts]\');view.querySelector(\'input[type=checkbox]\').click();const before=view.querySelector(\'[aria-label="전역 전처리"]\');before.value=\'req.headers.set("X-Global", "active");ctx.log("global-before");\';before.dispatchEvent(new Event(\'input\',{bubbles:true}));const after=view.querySelector(\'[aria-label="전역 후처리"]\');after.value=\'ctx.log("global-after");\';after.dispatchEvent(new Event(\'input\',{bubbles:true}));document.querySelector(\'#collectionHome\').click()`);',
    '  await js(`document.querySelector(\'#collectionHome\').click(); [...document.querySelectorAll(\'.overview-item button\')].find(b=>b.textContent===\'Configure interceptors\').click(); const view=document.querySelector(\'[data-view=scripts]\');view.querySelector(\'input[type=checkbox]\').click();const before=view.querySelector(\'[aria-label="Before Request Interceptor"]\');before.value=\'req.headers.set("X-Global", "active");ctx.log("collection-before");\';before.dispatchEvent(new Event(\'input\',{bubbles:true}));const after=view.querySelector(\'[aria-label="After Response Interceptor"]\');after.value=\'ctx.log("collection-after");\';after.dispatchEvent(new Event(\'input\',{bubbles:true}));document.querySelector(\'#collectionHome\').click()`);',
    "smoke collection interceptor editor",
  );
  text = replaceOnce(
    text,
    '  await js(`document.querySelector(\'#scriptsButton\').click()`);',
    '  await js(`document.querySelector(\'#collectionHome\').click(); [...document.querySelectorAll(\'.overview-item button\')].find(b=>b.textContent===\'Configure interceptors\').click()`);',
    "smoke interceptor screenshot entry",
  );
  text = replaceAllRequired(
    text,
    "document.querySelector('#specButton').click();",
    "document.querySelector('#collectionHome').click(); [...document.querySelectorAll('.overview-item button')].find(b=>b.textContent==='Import or synchronize').click();",
    2,
    "smoke collection OpenAPI entry",
  );
  return text;
});

await edit("docs/site/guide/variables-and-scripts.md", (text) => {
  text = replaceOnce(
    text,
    "## 전역 전후처리\n\n사이드바의 `전역 전후처리`에서 활성화합니다. 모든 컬렉션에 적용되며 컬렉션 Runner를 시작할 때 현재 스크립트 설정을 고정합니다.\n\n### 전처리 예시",
    "## 컬렉션 Interceptors\n\n컬렉션 Overview의 `Interceptors`에서 활성화합니다. 설정은 해당 컬렉션에만 적용되며 컬렉션 Runner를 시작할 때 현재 Interceptor 설정을 고정합니다.\n\n### Before Request 예시",
    "interceptor docs heading",
  );
  text = replaceOnce(text, "전처리에서 바꾼", "Before Request에서 바꾼", "before request docs");
  text = replaceOnce(text, "### 후처리 예시", "### After Response 예시", "after response docs heading");
  return text;
});

await edit("docs/site/reference/execution.md", (text) => {
  text = replaceOnce(text, "## 스크립트와 요청 순서", "## Interceptor와 요청 순서", "execution heading");
  text = replaceOnce(text, "2. 전처리 실행", "2. Collection Before Request Interceptor 실행", "execution before step");
  text = replaceOnce(text, "3. 전처리 결과 URL / method 재검증", "3. Before Request 결과 URL / method 재검증", "execution validation step");
  text = replaceOnce(text, "6. 후처리 실행", "6. Collection After Response Interceptor 실행", "execution after step");
  text = replaceOnce(text, "7. extract 값과 스크립트 Vars 변경을 실행 결과에 반영", "7. extract 값과 Interceptor Vars 변경을 실행 결과에 반영", "execution result step");
  text = replaceOnce(text, "전처리에서 저장된 요청 원본을 수정하지 않고", "Before Request Interceptor는 저장된 요청 원본을 수정하지 않고", "execution final note");
  return text;
});

await edit("docs/site/guide/getting-started.md", (text) => {
  text = replaceOnce(
    text,
    "1. 사이드바의 `+`로 컬렉션을 만듭니다.",
    "1. 사이드바의 `+`에서 빈 컬렉션 또는 `OpenAPI로 시작하기`를 선택합니다.",
    "getting started create collection",
  );
  text = replaceOnce(
    text,
    "- [Environment와 Vars](/guide/variables-and-scripts) — 변수 우선순위와 전후처리",
    "- [Environment와 Vars](/guide/variables-and-scripts) — 변수 우선순위와 컬렉션 Interceptors",
    "getting started interceptor link",
  );
  return text;
});

await edit("docs/site/guide/openapi-sync.md", (text) => {
  text = replaceOnce(
    text,
    "Free Rider의 OpenAPI 동기화는 명세를 즉시 덮어쓰는 방식이 아니라 **변경을 먼저 검토한 뒤 선택적으로 반영**하는 방식입니다.",
    "Free Rider의 OpenAPI 연결은 컬렉션 내부에서 관리합니다. 새 컬렉션을 만들 때 `OpenAPI로 시작하기`를 선택할 수도 있으며, 동기화는 명세를 즉시 덮어쓰지 않고 **변경을 먼저 검토한 뒤 선택적으로 반영**합니다.",
    "OpenAPI collection location docs",
  );
  return text;
});

await edit("docs/site/.vitepress/config.mjs", (text) =>
  replaceOnce(
    text,
    "{ text: 'Environment와 Vars', link: '/guide/variables-and-scripts' }",
    "{ text: 'Environment, Vars, Interceptors', link: '/guide/variables-and-scripts' }",
    "docs sidebar interceptor label",
  ),
);
