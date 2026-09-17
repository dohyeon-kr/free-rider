const test = require("node:test");
const assert = require("node:assert/strict");
const { specFetchOptions, readSpecSource } = require("../src/modules/sync/source.cjs");

const basic = { type: "basic", username: "Aladdin", password: "open sesame" };

test("Basic Auth uses the RFC 7617 example header", () => {
  assert.deepEqual(specFetchOptions(basic), {
    headers: { Authorization: "Basic QWxhZGRpbjpvcGVuIHNlc2FtZQ==" },
  });
});
test("legacy and No Auth imports do not send an Authorization header", () => {
  for (const auth of [undefined, null, { type: "none", username: "unused", password: "unused" }])
    assert.deepEqual(specFetchOptions(auth), {});
});
test("UTF-8 credentials, password colons and spaces are preserved", () => {
  const auth = { type: "basic", username: "도현", password: " 암호:🔑 " };
  const encoded = specFetchOptions(auth).headers.Authorization.slice(6);
  assert.equal(Buffer.from(encoded, "base64").toString("utf8"), "도현: 암호:🔑 ");
  assert.deepEqual(auth, { type: "basic", username: "도현", password: " 암호:🔑 " });
});
test("empty Basic Auth fields are valid and are not silently treated as No Auth", () => {
  assert.equal(specFetchOptions({ type: "basic", username: "", password: "" }).headers.Authorization, "Basic Og==");
});
test("unsupported authentication and malformed credentials fail before fetch", () => {
  for (const auth of ["basic", {}, { type: "bearer" }, { type: "basic", username: 7, password: "" }, { type: "basic", username: "", password: {} }])
    assert.throws(() => specFetchOptions(auth), /인증|Basic Auth/);
  assert.throws(() => specFetchOptions({ ...basic, username: "user:name" }), /콜론/);
  for (const key of ["username", "password"])
    for (const value of ["a\nb", "a\rb", "a\0b", "a\x7fb"])
      assert.throws(() => specFetchOptions({ ...basic, [key]: value }), /제어 문자/);
});
test("authenticated source fetch forwards options and returns only the document", async () => {
  let seen;
  const text = '{"openapi":"3.0.3"}';
  const result = await readSpecSource("  https://example.test/openapi.json  ", basic, async (url, options) => {
    seen = { url, options };
    return { status: 200, body: text };
  });
  assert.deepEqual(seen, { url: "https://example.test/openapi.json", options: specFetchOptions(basic) });
  assert.equal(result, text);
});
test("JSON and YAML success bodies are passed through unchanged", async () => {
  for (const text of ['{"openapi":"3.1.0"}', "openapi: 3.0.3\npaths: {}\n"])
    assert.equal(await readSpecSource("https://example.test/spec", undefined, async () => ({ status: 200, body: text })), text);
});
test("invalid URLs, protocols and embedded credentials never reach the network", async () => {
  let calls = 0;
  for (const url of ["", "not a URL", "file:///tmp/spec.json", "ftp://example.test/spec", "https://user:secret@example.test/spec"])
    await assert.rejects(readSpecSource(url, basic, async () => { calls++; }), /HTTP|URL|인증/);
  assert.equal(calls, 0);
});
test("401 explains Basic Auth without echoing response bodies or credentials", async () => {
  await assert.rejects(readSpecSource("https://example.test/spec", basic, async () => ({ status: 401, body: "open sesame" })), error => {
    assert.match(error.message, /401.*Basic Auth/);
    assert.ok(!error.message.includes(basic.password));
    return true;
  });
});
test("403 explains permissions and other HTTP failures retain the status", async () => {
  await assert.rejects(readSpecSource("https://example.test/spec", basic, async () => ({ status: 403, body: "private" })), /403.*권한/);
  for (const status of [302, 404, 500])
    await assert.rejects(readSpecSource("https://example.test/spec", basic, async () => ({ status, body: "private" })), new RegExp(`HTTP ${status}`));
});
test("network errors are propagated without retrying with another auth mode", async () => {
  const failure = new Error("network offline");
  let calls = 0;
  await assert.rejects(readSpecSource("https://example.test/spec", basic, async () => { calls++; throw failure; }), error => error === failure);
  assert.equal(calls, 1);
});
