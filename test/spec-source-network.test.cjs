const test = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");
const { fetchText } = require("../src/network.cjs");
const { readSpecSource } = require("../src/modules/sync/source.cjs");

test("spec authentication works with the real bounded transport and cannot follow redirects", async t => {
  const auth = { type: "basic", username: "reader", password: "암호: secret" };
  const expected = "Basic " + Buffer.from(`${auth.username}:${auth.password}`).toString("base64");
  const document = JSON.stringify({ openapi: "3.0.3", info: { title: "Private", version: "1" }, paths: {} });
  let redirected = 0;
  const server = http.createServer((req, res) => {
    if (req.url === "/redirect") { res.writeHead(302, { Location: "/target" }); return res.end(); }
    if (req.url === "/target") redirected++;
    if (req.url === "/public") {
      assert.equal(req.headers.authorization, undefined);
      return res.end(document);
    }
    if (req.headers.authorization !== expected) {
      res.writeHead(401, { "WWW-Authenticate": 'Basic realm="OpenAPI", charset="UTF-8"' });
      return res.end("Unauthorized");
    }
    res.end(document);
  });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  t.after(() => new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }));
  const base = `http://127.0.0.1:${server.address().port}`;
  await assert.rejects(readSpecSource(base + "/private", undefined, fetchText), /401/);
  await assert.rejects(readSpecSource(base + "/private", { ...auth, password: "wrong" }, fetchText), /401/);
  assert.equal(await readSpecSource(base + "/private", auth, fetchText), document);
  assert.equal(await readSpecSource(base + "/public", { type: "none" }, fetchText), document);
  await assert.rejects(readSpecSource(base + "/redirect", auth, fetchText));
  assert.equal(redirected, 0);
});
