const { test } = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");
const { prepare } = require("../src/modules/runner/request.cjs");
const { execute } = require("../src/modules/runner/index.cjs");

const multipartBody = (parts) =>
  JSON.stringify({ __freeRiderMultipart: 1, parts });

test("multipart body resolves text variables without embedding file bytes", () => {
  const prepared = prepare(
    {
      method: "POST",
      url: "https://example.com/upload",
      bodyType: "multipart",
      body: multipartBody([
        { id: "note", kind: "text", key: "note", value: "hello {{id}}" },
        { id: "file-1", kind: "file", key: "upload", file: { name: "demo.bin" } },
      ]),
    },
    { id: 42 },
  );
  assert.equal(prepared.body.parts[0].value, "hello 42");
  assert.deepEqual(prepared.body.parts[1], {
    kind: "file",
    key: "upload",
    id: "file-1",
    name: "demo.bin",
    type: "application/octet-stream",
  });
});

test("runner sends multipart text and binary file parts with an automatic boundary", async (t) => {
  const server = http.createServer((req, res) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => {
      const body = Buffer.concat(chunks);
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({
        contentType: req.headers["content-type"],
        body: body.toString("base64"),
      }));
    });
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(() => server.close());
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  const file = Buffer.from([0, 1, 2, 3, 255]);
  const result = await execute(
    {
      method: "POST",
      url: "{{baseUrl}}/upload",
      headers: [{ key: "Content-Type", value: "multipart/form-data", enabled: true }],
      bodyType: "multipart",
      body: multipartBody([
        { id: "note", kind: "text", key: "note", value: "hello" },
        { id: "file-1", kind: "file", key: "upload", file: { name: "demo.bin" } },
      ]),
    },
    { baseUrl },
    undefined,
    {},
    { baseUrl },
    async (id) => {
      assert.equal(id, "file-1");
      return { data: file, name: "demo.bin", type: "application/octet-stream" };
    },
  );
  const received = JSON.parse(result.body);
  assert.match(received.contentType, /^multipart\/form-data; boundary=/);
  const body = Buffer.from(received.body, "base64");
  const text = body.toString("latin1");
  assert.match(text, /name="note"/);
  assert.match(text, /hello/);
  assert.match(text, /name="upload"; filename="demo.bin"/);
  assert.notEqual(body.indexOf(file), -1);
});
