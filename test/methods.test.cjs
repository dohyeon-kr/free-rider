const test = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");
const { execute } = require("../src/modules/runner/index.cjs");
const { prepare } = require("../src/modules/runner/request.cjs");

test("QUERY sends its method, headers and body to a real HTTP server", async (t) => {
  const server = http.createServer(async (req, res) => {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({method:req.method, body:Buffer.concat(chunks).toString(), header:req.headers["x-env"]}));
  });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  t.after(() => { server.closeAllConnections(); server.close(); });
  const response = await execute({
    method:"QUERY", url:"http://127.0.0.1:"+server.address().port,
    headers:{"Content-Type":"application/json","X-Env":"{{ENV}}"},
    body:'{"query":"{{TERM}}"}'
  }, {ENV:"local", TERM:"hello"});
  assert.equal(response.status, 200);
  assert.deepEqual(JSON.parse(response.body), {method:"QUERY",body:'{"query":"hello"}',header:"local"});
});

test("custom method tokens are accepted and invalid or unavailable methods explain failure", () => {
  const req = {url:"http://localhost/", body:""};
  assert.equal(prepare({...req,method:"purge"},{}).method,"PURGE");
  for (const method of ["", "GET\r\nX: bad", "BAD METHOD"])
    assert.throws(() => prepare({...req,method},{}), /올바른 HTTP/);
  for (const method of ["CONNECT","TRACE","TRACK"])
    assert.throws(() => prepare({...req,method},{}), /현재 전송 엔진/);
});
