// Invoked only by the macOS CI smoke-test flag; fixture never enters normal workspaces.
const http = require("node:http");
const fs = require("node:fs/promises");
const path = require("node:path");
let server, baseUrl;
async function start() {
  server = http.createServer((req, res) => {
    res.setHeader("Content-Type", "application/json");
    if (req.url === "/login") res.end('{"token":"test-token"}');
    else {
      res.statusCode =
        req.headers.authorization === "Bearer test-token" ? 200 : 401;
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
  const js = (code) => win.webContents.executeJavaScript(code);
  await js("window.appReady");
  await screenshot("collection");
  await js(
    `document.querySelector('#runnerButton').click(); document.querySelectorAll('.run-item input[type=checkbox]')[0].click(); document.querySelectorAll('.run-item input[type=checkbox]')[1].click();document.querySelector('#runSelected').click();`,
  );
  await poll(() =>
    js(
      `document.querySelector('#status').textContent.includes('2/2 requests')`,
    ),
  );
  const statuses = await js(
    `[...document.querySelectorAll('.run-item .result')].slice(0,2).map(e=>e.textContent)`,
  );
  if (!statuses.every((s) => s.startsWith("200")))
    throw Error("Login chain failed: " + statuses);
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
    `document.querySelector('#newRequest').click();document.querySelector('#dialogName').value='Unsaved request';document.querySelector('#dialogConfirm').click()`,
  );
  if (
    !(await js(
      `!!document.querySelector('#requestUrl')&&!!document.querySelector('.dirty-dot')`,
    ))
  )
    throw Error("Request creation/dirty tracking failed");
  await js(`window.client['clear-tokens']()`);
  server.close();
  return "Native tabs, runner login chain, inherited auth, assertions, environments and IPC passed";
  async function screenshot(name) {
    await fs.writeFile(
      path.join("test-results", name + ".png"),
      (await win.webContents.capturePage()).toPNG(),
    );
  }
}
async function poll(fn) {
  for (let i = 0; i < 100; i++) {
    if (await fn()) return;
    await new Promise((r) => setTimeout(r, 100));
  }
  throw Error("UI test timed out");
}
module.exports = { start, fixture, run };
