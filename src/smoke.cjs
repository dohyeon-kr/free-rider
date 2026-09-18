// Invoked only by the macOS CI smoke-test flag; fixture never enters normal workspaces.
const http = require("node:http");
const fs = require("node:fs/promises");
const path = require("node:path");
let server, baseUrl, workspacePath, envPath, specPath, gitPath;
async function start() {
  workspacePath=path.join(await fs.mkdtemp(path.join(require("node:os").tmpdir(),"free-rider-smoke-")),"workspace.enc");
  gitPath=path.join(path.dirname(workspacePath),"repo");
  await fs.mkdir(gitPath);
  require("node:child_process").execFileSync("git",["init","-q",gitPath]);
  envPath=path.join(path.dirname(workspacePath),".env.dev");
  specPath=path.join(path.dirname(workspacePath),"openapi.json");
  await fs.writeFile(envPath,"BASE_URL=https://example.com\n");
  await fs.writeFile(specPath,JSON.stringify({openapi:"3.0.3",info:{title:"File fixture",version:"1"},paths:{"/file-test":{get:{summary:"File endpoint",responses:{"200":{description:"OK"}}}}}}));
  server = http.createServer((req, res) => {
    res.setHeader("Content-Type", "application/json");
    if (require("./spec-auth-smoke.cjs").serve(req, res)) return;
    if (req.url === "/spec") return res.end(JSON.stringify({
      openapi:"3.0.3",info:{title:"Fixture",version:"1"},
      servers:[{url:"/api"}],paths:{"/review-test":{get:{summary:"Review fixture",responses:{"200":{description:"OK"}}}}}
    }));
    if (req.url === "/login") {
      res.setHeader("Set-Cookie", "smoke_session=active; Path=/; HttpOnly; SameSite=Lax");
      res.end('{"token":"test-token"}');
    }
    else {
      res.statusCode =
        req.headers.authorization === "Bearer test-token" &&
        req.headers["x-global"] === "active" &&
        String(req.headers.cookie || "").includes("smoke_session=active") ? 200 : 401;
      res.end(
        JSON.stringify({
          id: 1,
          name: "API developer",
          authorized: res.statusCode === 200,
        }),
      );
    }
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  baseUrl = "http://127.0.0.1:" + server.address().port;
}
function fixture() {
  const req = (id, name, method, url, group, extra = {}) => ({
    id,
    name,
    method,
    url,
    group,
    query: [],
    headers: [],
    vars: [],
    body: "",
    manual: true,
    authConfig: { type: "inherit" },
    assertions: [],
    ...extra,
  });
  return {
    collections: [
      {
        id: "ci",
        version: 1,
        title: "Workspace API",
        description:
          "A collection for verifying local API collaboration workflows.",
        source: "",
        folders: [],
        vars: [],
        headers: [],
        authConfig: { type: "bearer", token: "{{token}}" },
        requests: [
          req("login", "Login", "POST", "{{baseUrl}}/login", "auth", {
            authConfig: { type: "none" },
            extract: { token: "token" },
          }),
          req("me", "Current user", "GET", "{{baseUrl}}/me", "users", {
            assertions: [
              {
                expression: "res.status",
                operator: "equals",
                value: "200",
                enabled: true,
              },
            ],
          }),
          req(
            "list",
            "List notifications",
            "GET",
            "{{baseUrl}}/notifications",
            "notifications",
          ),
          req(
            "create",
            "Create notification",
            "POST",
            "{{baseUrl}}/notifications",
            "notifications",
          ),
          req(
            "settings",
            "User settings",
            "GET",
            "{{baseUrl}}/settings",
            "users/preferences",
          ),
        ],
        environments: [{ id: "local", name: "Local", values: { baseUrl } }],
      },
    ],
    activeCollection: "ci",
    tabs: [],
    activeTab: null,
    selectedEnvironments: {},
    layout: "vertical",
  };
}
async function run(win) {
  await fs.mkdir("test-results", { recursive: true });
  const js = async (code) => {
    try { return await win.webContents.executeJavaScript(code); }
    catch (error) { throw new Error("Renderer check failed: " + code + "\n" + error.message); }
  };
  await poll(() => js("Boolean(window.appReady)"));
  await js("window.appReady");
  if(!await js(`!!document.querySelector("[data-view=overview]")&&document.querySelector("#activeTitle").textContent==="Workspace API"`))throw Error("Overview did not initialize");
  await js(`document.querySelector('#newCollection').click(); if (![...document.querySelectorAll('#dialogContent button')].some(b=>b.textContent==='OpenAPI로 시작하기')) throw new Error('OpenAPI collection start option missing'); document.querySelector('#dialogCancel').click()`);
  if (await js(`document.querySelector('#dialog').open`))
    throw Error("Empty collection name prevented cancellation");
  await js(`document.querySelector('#openCollection').click()`);
  if (!(await js(`document.querySelector('#collectionActions').matches(':popover-open') && !!document.querySelector('#importCollectionFile')`)))
    throw Error("Collection actions menu did not open");
  await js(`document.querySelector('#exportActiveCollection').click()`);
  if (!(await js(`document.querySelector('#dialog').open && document.querySelector('#dialogTitle').textContent === 'Export Collection' && !document.querySelector('#collectionActions').matches(':popover-open')`)))
    throw Error("Collection export menu action failed");
  await js(`document.querySelector('#dialogCancel').click()`);
  await js(`document.querySelector('#collectionHome').click(); [...document.querySelectorAll('.overview-item button')].find(b=>b.textContent==='Configure interceptors').click(); const view=document.querySelector('[data-view=scripts]');view.querySelector('input[type=checkbox]').click();const before=view.querySelector('[aria-label="Before Request Interceptor"]');before.value='req.headers.set("X-Global", "active");ctx.log("collection-before");';before.dispatchEvent(new Event('input',{bubbles:true}));const after=view.querySelector('[aria-label="After Response Interceptor"]');after.value='ctx.log("collection-after");';after.dispatchEvent(new Event('input',{bubbles:true}));document.querySelector('#collectionHome').click()`);
  await js(`document.querySelector('#collectionHome').click(); [...document.querySelectorAll('.overview-item button')].find(b=>b.textContent==='Configure interceptors').click()`);
  await screenshot("scripts");
  await js(`document.querySelector('#collectionHome').click()`);
  await screenshot("collection");
  await js(`document.querySelector('#runnerButton').click(); document.querySelector('[data-exclude="list"]').click()`);
  if ((await js(`document.querySelectorAll('[data-view=runner] .run-item').length`)) !== 4) throw Error("Run exclude failed");
  await js(`document.querySelector('#addEndpoints').click(); document.querySelector('.endpoint-picker input:not(:disabled)').click(); document.querySelector('#dialogConfirm').click()`);
  await poll(() => js(`!document.querySelector('#dialog').open`));
  if ((await js(`document.querySelectorAll('[data-view=runner] .run-item').length`)) !== 5) throw Error("Run add failed");
  await js(`document.querySelectorAll('[data-view=runner] .run-item input[type=checkbox]')[4].click()`);
  await js(
    `document.querySelector('#runnerButton').click(); document.querySelectorAll('[data-view=runner] .run-item input[type=checkbox]')[0].click(); document.querySelectorAll('[data-view=runner] .run-item input[type=checkbox]')[1].click();document.querySelector('#runSelected').click();`,
  );
  await poll(() =>
    js(
      `document.querySelector('#status').textContent.includes('2/2 requests')`,
    ),
  );
  await screenshot("runner");
  const statuses = await js(
    `[...document.querySelectorAll('[data-view=runner] .run-item .result')].slice(0,2).map(e=>e.textContent)`,
  );
  if (!statuses.every((s) => s.startsWith("200")))
    throw Error("Login chain failed: " + statuses);
  if (!(await js(`document.querySelector('#networkButton')?.textContent.includes('2')`)))
    throw Error("Network history did not receive runner requests");
  await js(`document.querySelector('#networkButton').click()`);
  if (!(await js(`!document.querySelector('#networkDrawer').hidden && document.querySelectorAll('#networkDrawer .network-entry').length >= 2`)))
    throw Error("Network panel did not render request history");
  await js(`[...document.querySelectorAll('#networkDrawer .network-detail-tabs button')].find(b=>b.textContent==='Cookies').click()`);
  if (!(await js(`document.querySelector('#networkDrawer').textContent.includes('smoke_session')`)))
    throw Error("Network panel did not expose Cookie Jar state");
  await screenshot("network");
  await js(`document.querySelector('#networkDrawer .network-close').click()`);
  await js(
    `[...document.querySelectorAll('#tree .tree-label')].find(e=>e.textContent.includes('Current user')).click()`,
  );
  await screenshot("request");
  await js(`document.querySelector('[data-tab="auth"]').click()`);
  if (!(await js(`!!document.querySelector('#authType')`)))
    throw Error("Auth editor missing");
  await js(`document.querySelector('#envButton').click()`);
  if (!(await js(`!!document.querySelector('[data-view="environments"]')`)))
    throw Error("Environments missing");
  await screenshot("environments");
  await js(
    `document.querySelector('#newRequest').click();document.querySelector('#dialogName').value='Unsaved request';document.querySelector('#dialogName').dispatchEvent(new Event('input',{bubbles:true}));document.querySelector('#dialogConfirm').click()`,
  );
  if (
    !(await js(
      `!!document.querySelector('#requestUrl')&&!!document.querySelector('.dirty-dot')`,
    ))
  )
    throw Error("Request creation/dirty tracking failed");
  const curlCommand = `curl '${baseUrl}/me?empty=&a=1&a=2' -H 'Authorization: Bearer test-token' --json '{"hello":"world"}'`;
  await js(`(() => {
    const data = new DataTransfer();
    data.setData('text/plain', ${JSON.stringify(curlCommand)});
    document.querySelector('#requestUrl').dispatchEvent(new ClipboardEvent('paste', {clipboardData: data, bubbles: true, cancelable: true}));
  })()`);
  if (!(await js(`document.querySelector('#requestUrl').value.endsWith('/me?empty=&a=1&a=2') && document.querySelector('#httpMethod').value === 'POST' && document.querySelector('.request-content textarea').value === '{"hello":"world"}'`)))
    throw Error('cURL paste did not populate request');
  await js(`document.querySelector('#sendRequest').click()`);
  await poll(() => js(`document.querySelector('#sendRequest')?.textContent === 'Send'`));
  if (!(await js(`document.querySelector('.response')?.textContent.includes('200') || document.querySelector('.response-pane')?.textContent.includes('200')`))) {
    // Check the visible response status without relying on panel layout.
    if (!(await js(`document.body.textContent.includes('200 OK')`))) throw Error('Imported cURL request failed');
  }
  const importedUrl = await js(`document.querySelector('#requestUrl').value`);
  await js(`(() => {
    const data = new DataTransfer(); data.setData('text/plain', "curl 'broken");
    document.querySelector('#requestUrl').dispatchEvent(new ClipboardEvent('paste', {clipboardData: data, bubbles: true, cancelable: true}));
  })()`);
  if (await js(`document.querySelector('#requestUrl').value`) !== importedUrl)
    throw Error('Failed cURL import changed request');
  await js(`window.client['clear-tokens']()`);
  win.webContents.sendInputEvent({
    type: "keyDown",
    keyCode: "W",
    modifiers: ["meta"],
  });
  win.webContents.sendInputEvent({
    type: "keyUp",
    keyCode: "W",
    modifiers: ["meta"],
  });
  await poll(() => js(`document.querySelector('#dialog').open && !!document.querySelector('#discardRequest')`));
  await js(`document.querySelector('#dialogCancel').click()`);
  if (!(await js(`!!document.querySelector('#requestUrl')`))) throw Error("Cancel closed the request");
  await js(`document.querySelector('.work-tab.active .close').click(); document.querySelector('#discardRequest').click()`);
  await poll(() => js(`!document.querySelector('#requestUrl')`));
  await js(`[...document.querySelectorAll('#tree .tree-label')].find(e=>e.textContent.includes('Unsaved request')).click()`);
  if ((await js(`document.querySelector('#requestUrl').value`)) === importedUrl)
    throw Error("Discard retained draft changes");
  await js(`const url = document.querySelector('#requestUrl'); url.value = 'http://localhost:3456/saved'; url.dispatchEvent(new Event('input',{bubbles:true})); document.querySelector('.work-tab.active .close').click(); document.querySelector('#dialogConfirm').click()`);
  await poll(() => js(`!document.querySelector('#dialog').open`));
  await js(`[...document.querySelectorAll('#tree .tree-label')].find(e=>e.textContent.includes('Unsaved request')).click()`);
  if ((await js(`document.querySelector('#requestUrl').value`)) !== 'http://localhost:3456/saved')
    throw Error("Save did not commit draft");

  await js(`(() => { const url = document.querySelector('#requestUrl'); url.value = 'http://localhost:3456/edited'; url.dispatchEvent(new Event('input',{bubbles:true})); })()`);
  win.webContents.sendInputEvent({
    type: "keyDown",
    keyCode: "Z",
    modifiers: ["meta"],
  });
  win.webContents.sendInputEvent({
    type: "keyUp",
    keyCode: "Z",
    modifiers: ["meta"],
  });
  await poll(() => js(`document.querySelector('#requestUrl').value === 'http://localhost:3456/saved'`));
  win.webContents.sendInputEvent({
    type: "keyDown",
    keyCode: "Z",
    modifiers: ["meta", "shift"],
  });
  win.webContents.sendInputEvent({
    type: "keyUp",
    keyCode: "Z",
    modifiers: ["meta", "shift"],
  });
  await poll(() => js(`document.querySelector('#requestUrl').value === 'http://localhost:3456/edited'`));

  await js(`document.querySelector("#collectionHome").click()`);
  await screenshot("collection");
  await js(`[...document.querySelectorAll('#tree .tree-label')].find(e=>e.textContent.includes('Unsaved request')).click(); const invalid = document.querySelector('#requestUrl'); invalid.value='/relative'; invalid.dispatchEvent(new Event('input',{bubbles:true})); document.querySelector('#sendRequest').click()`);
  await poll(() => js(`!!document.querySelector('.execution-log.error')`));
  if (!(await js(`document.querySelector('.execution-log.error').textContent.includes('절대 주소')`)))
    throw Error("Console did not explain invalid URL");
  await js(`document.querySelector('.response-pane [data-tab="body"]').click()`);
  if (!(await js(`document.querySelector('.response-pane').textContent.includes('수신한 응답이 없습니다')`)))
    throw Error("Execution error leaked into response body");
  await js(`document.querySelector('#collectionHome').click(); [...document.querySelectorAll('.overview-item button')].find(b=>b.textContent==='Import or synchronize').click(); const source=document.querySelector('[placeholder="https://api.example.com/openapi.json"]'); source.value=${JSON.stringify(baseUrl + "/spec")}; source.dispatchEvent(new Event('input',{bubbles:true})); [...document.querySelectorAll('button')].find(b=>b.textContent.includes('Synchronize')).click()`);
  await poll(() => js(`!!document.querySelector('#applySyncSelection')`));
  if (await js(`document.querySelector('#tree').textContent.includes('Review fixture')`)) throw Error("Preview modified collection");
  await js(`document.querySelector('.sync-change summary').click(); document.querySelector('#applySyncSelection').click()`);
  await poll(() => js(`document.querySelector('#tree').textContent.includes('Review fixture')`));
  await js(`document.querySelector('#saveWorkspace').click()`);
  await poll(() => js(`document.querySelector('#status').textContent.includes('워크스페이스를 저장')`));
  await js(`document.querySelector('#undoSync').click();document.querySelector('#dialogConfirm').click()`);
  await poll(() => js(`!document.querySelector('#dialog').open`));
  if(await js(`document.querySelector('#tree').textContent.includes('Review fixture')`))
    throw Error("Sync undo did not restore previous requests");
  await js(`document.querySelector('#envButton').click()`);
  await poll(()=>js(`(()=>{
    const view=document.querySelector('[data-view="environments"]');
    const button=document.querySelector('#connectEnvFile');
    const workspace=document.querySelector('.workspace');
    return !!view && !!button && button.getClientRects().length > 0 && !button.disabled && !workspace?.inert;
  })()`));
  const envStatus=await js(`document.querySelector('#status').textContent`);
  await js(`document.querySelector('#connectEnvFile').click()`);
  await poll(()=>js(`!!document.querySelector('[aria-label="환경 파일 내용"]') || document.querySelector('#status').textContent !== ${JSON.stringify(envStatus)}`));
  if(!(await js(`!!document.querySelector('[aria-label="환경 파일 내용"]')`)))
    throw Error("Environment file connection failed: "+await js(`document.querySelector('#status').textContent`));
  await js(`const editor=document.querySelector('[aria-label="환경 파일 내용"]');editor.value='BASE_URL=https://changed.example.com';editor.dispatchEvent(new Event('input',{bubbles:true}));[...document.querySelectorAll('button')].find(b=>b.textContent==='파일 저장').click()`);
  await poll(async()=> (await fs.readFile(envPath,"utf8")).includes("changed.example.com"));
  await screenshot("env-file");
  await js(`document.querySelector('#collectionHome').click(); [...document.querySelectorAll('.overview-item button')].find(b=>b.textContent==='Import or synchronize').click();[...document.querySelectorAll('button')].find(b=>b.textContent==='Import OpenAPI file').click()`);
  await poll(()=>js(`!!document.querySelector('#reloadSpecFile')`));
  await js(`document.querySelector('#applySyncSelection').click()`);
  await poll(()=>js(`document.querySelector('#tree').textContent.includes('File endpoint')`));
  await fs.writeFile(specPath,JSON.stringify({openapi:"3.0.3",info:{title:"File fixture",version:"2"},paths:{"/file-test":{get:{summary:"File endpoint",parameters:[{name:"limit",in:"query",required:false,schema:{type:"integer"}}],responses:{"200":{description:"OK"}}}}}}));
  await js(`document.querySelector('#reloadSpecFile').click()`);
  await poll(()=>js(`document.querySelector('.sync-review')?.textContent.includes('limit')`));
  await js(`document.querySelector('.sync-change summary').click()`);
  await screenshot("sync");
  await js(`document.querySelector('#saveWorkspace').click()`);
  await poll(()=>js(`document.querySelector('#status').textContent.includes('워크스페이스를 저장')`));
  await new Promise(resolve=>{win.webContents.once("did-finish-load",resolve);win.webContents.reload();});
  await js("window.appReady");
  await js(`document.querySelector('#collectionHome').click(); [...document.querySelectorAll('.overview-item button')].find(b=>b.textContent==='Configure interceptors').click()`);
  if(!(await js(`document.querySelector('[data-view=scripts] input[type=checkbox]').checked && document.querySelector('[aria-label="Before Request Interceptor"]').value.includes('X-Global')`)))
    throw Error("Collection interceptors were not restored from disk");
  await js(`document.querySelector('#runnerButton').click()`);
  if((await js(`document.querySelectorAll('[data-view=runner] .run-item').length`))!==5)
    throw Error("Execution list was not restored from disk");
  await js(`document.querySelector('#gitButton').click();[...document.querySelectorAll('button')].find(b=>b.textContent==='Open repository folder').click()`);
  await poll(()=>js(`document.querySelector('[data-view=git]').textContent.includes('최근 컬렉션 커밋')`));
  await screenshot("git");
  await require("./git-create-smoke.cjs").run({ js, poll, win, gitPath });
  await require("./spec-auth-smoke.cjs").run({ js, poll, baseUrl, win });
  server.close();
  await fs.rm(path.dirname(workspacePath),{recursive:true,force:true});
  return "Native tabs, Network panel, runner login chain with Cookie Jar, inherited auth, assertions, environments and IPC passed";
  async function screenshot(name) {
    await js(
      "new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))",
    );
    await new Promise(resolve=>setTimeout(resolve,250));
    await fs.writeFile(
      path.join("test-results", name + ".png"),
      (await win.webContents.capturePage()).toPNG(),
    );
  }
}
async function poll(fn) {
  const attempts = process.env.CI ? 300 : 100;
  for (let i = 0; i < attempts; i++) {
    if (await fn()) return;
    await new Promise((r) => setTimeout(r, 100));
  }
  throw Error("UI test timed out");
}
module.exports = { chooseFile:options=>options.title==="환경 파일 연결"?envPath:options.filters?.[0]?.name==="OpenAPI"?specPath:options.properties?.includes("openDirectory")?gitPath:null, start, fixture, run, get workspacePath(){return workspacePath;} };
