// Called only by the existing --smoke-test harness.
const credentials = { username: "spec-reader", password: "spec-only:암호" };
const document = JSON.stringify({ openapi: "3.0.3", info: { title: "Private specification", version: "1" }, paths: { "/private-test": { get: { responses: { "200": { description: "OK" } } } } } });
function serve(req, res) {
  if (!["/spec-basic-auth", "/spec-no-auth-check"].includes(req.url)) return false;
  const expected = "Basic " + Buffer.from(`${credentials.username}:${credentials.password}`).toString("base64");
  if (req.url === "/spec-basic-auth" && req.headers.authorization !== expected) {
    res.writeHead(401, { "WWW-Authenticate": 'Basic realm="OpenAPI", charset="UTF-8"' });
    res.end("Unauthorized");
  } else if (req.url === "/spec-no-auth-check" && req.headers.authorization) {
    res.writeHead(400);
    res.end("Unexpected specification credentials");
  } else res.end(document);
  return true;
}
async function run({ js, poll, baseUrl, win }) {
  const input = async (selector, value) => js(`(() => {
    const input = document.querySelector(${JSON.stringify(selector)});
    if (!input) throw Error('Missing input: ' + ${JSON.stringify(selector)});
    input.value = ${JSON.stringify(value)};
    input.dispatchEvent(new Event(input.tagName === 'SELECT' ? 'change' : 'input', {bubbles:true}));
  })()`);
  const success = () => poll(() => js(`document.querySelector('#status').textContent.includes('변경 검토 후')`));
  const sync = () => js(`[...document.querySelectorAll('[data-view=spec] button')].find(b=>b.textContent.includes('Synchronize')).click()`);
  await js(`document.querySelector('#newCollection').click();[...document.querySelectorAll('#dialogContent button')].find(b=>b.textContent==='OpenAPI로 시작하기').click()`);
  await input('#dialogContent input[placeholder="https://api.example.com/openapi.json"]', baseUrl + "/spec-basic-auth");
  await js(`document.querySelector('#dialogConfirm').click()`);
  await poll(() => js(`document.querySelector('#status').textContent.includes('401')`));
  if (!await js(`document.querySelector('#dialog').open`)) throw Error("Failed import closed the dialog");
  await input('#dialogContent [data-spec-auth-type]', "basic");
  await input('#dialogContent [data-spec-auth-username]', credentials.username);
  await input('#dialogContent [data-spec-auth-password]', credentials.password);
  if (!await js(`document.querySelector('#dialogContent [data-spec-auth-password]').type==='password'`)) throw Error("Specification password is not masked");
  await js(`document.querySelector('#dialogContent [data-spec-auth] .secret-toggle').click()`);
  if (!await js(`document.querySelector('#dialogContent [data-spec-auth-password]').type==='text'`)) throw Error("Specification password reveal failed");
  await js(`document.querySelector('#dialogContent [data-spec-auth] .secret-toggle').click();document.querySelector('#dialogConfirm').click()`);
  await success();
  await poll(() => js(`!document.querySelector('#dialog').open`));
  await js(`document.querySelector('#envButton').click();document.querySelector('#specButton').click()`);
  if (await js(`document.querySelector('[data-view=spec] [data-spec-auth-password]').value`) !== credentials.password) throw Error("Spec auth was lost during navigation");
  await sync();
  await success();
  await input('[data-view=spec] [data-spec-auth-password]', "wrong");
  await sync();
  await poll(() => js(`document.querySelector('#status').textContent.includes('401')`));
  await input('[data-view=spec] [data-spec-auth-password]', credentials.password);
  await sync();
  await success();
  await js(`document.querySelector('#saveWorkspace').click()`);
  await poll(() => js(`document.querySelector('#status').textContent.includes('워크스페이스를 저장했습니다.')`));
  const saved = JSON.stringify(await js(`window.client['workspace-load']()`));
  if (saved.includes(credentials.password) || saved.includes(credentials.username)) throw Error("Specification credentials were persisted");
  await input('[data-view=spec] input[placeholder="https://api.example.com/openapi.json"]', baseUrl + "/spec-no-auth-check");
  if (!await js(`document.querySelector('[data-view=spec] [data-spec-auth-type]').value==='none'&&!document.querySelector('[data-view=spec] [data-spec-auth-password]')`)) throw Error("Changing source did not clear credentials");
  await sync();
  await success();
  await input('[data-view=spec] input[placeholder="https://api.example.com/openapi.json"]', baseUrl + "/spec-basic-auth");
  await input('[data-view=spec] [data-spec-auth-type]', "basic");
  await input('[data-view=spec] [data-spec-auth-username]', credentials.username);
  await input('[data-view=spec] [data-spec-auth-password]', credentials.password);
  await new Promise(resolve => { win.webContents.once("did-finish-load", resolve); win.webContents.reload(); });
  await js("window.appReady");
  await js(`document.querySelector('#specButton').click()`);
  if (!await js(`document.querySelector('[data-view=spec] [data-spec-auth-type]').value==='none'`)) throw Error("Specification credentials survived a new renderer session");
}
module.exports = { serve, run };
