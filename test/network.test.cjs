const { test } = require("node:test");
const assert = require("node:assert/strict");
const { execute, fetchText } = require("../src/modules/runner/index.cjs");

test("fetchText accepts a custom fetcher and records response timing", async () => {
  let called;
  const result = await fetchText(
    "https://example.com/health",
    { method: "GET" },
    async (url, options) => {
      called = { url, options };
      return new Response("ok", {
        status: 200,
        headers: { "Content-Type": "text/plain", "Set-Cookie": "sid=abc; Path=/; HttpOnly" },
      });
    },
  );
  assert.equal(called.url, "https://example.com/health");
  assert.equal(called.options.method, "GET");
  assert.equal(result.status, 200);
  assert.equal(result.body, "ok");
  assert.equal(result.bytes, 2);
  assert.ok(result.timing.total >= 0);
  assert.ok(result.timing.waiting >= 0);
  assert.ok(result.timing.download >= 0);
  if (typeof Headers.prototype.getSetCookie === "function")
    assert.deepEqual(result.setCookies, ["sid=abc; Path=/; HttpOnly"]);
});

test("execute exposes the final prepared request for Network history", async () => {
  let sent;
  const result = await execute(
    {
      method: "POST",
      url: "{{baseUrl}}/users",
      headers: [{ key: "X-Test", value: "{{token}}", enabled: true }],
      bodyType: "json",
      body: '{"name":"Free Rider"}',
    },
    { baseUrl: "https://example.com", token: "abc" },
    undefined,
    {},
    {},
    undefined,
    async (url, options) => {
      sent = { url, options };
      return new Response('{"ok":true}', {
        status: 201,
        headers: { "Content-Type": "application/json" },
      });
    },
  );
  assert.equal(sent.url, "https://example.com/users");
  assert.equal(sent.options.headers["X-Test"], "abc");
  assert.equal(result.request.url, "https://example.com/users");
  assert.equal(result.request.method, "POST");
  assert.equal(result.request.headers["X-Test"], "abc");
  assert.equal(result.request.body, '{"name":"Free Rider"}');
  assert.equal(result.status, 201);
});
