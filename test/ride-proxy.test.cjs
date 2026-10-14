const test = require("node:test");
const assert = require("node:assert/strict");

test("Ride rewrites baseUrl templated requests without changing originals", async () => {
  const { routeRideThroughMockProxy } = await import("../src/ui/ride-proxy.mjs");
  const original = { id: "a", url: "{{baseUrl}}/users?limit={{limit}}" };
  const routed = routeRideThroughMockProxy(original, {url:"http://127.0.0.1:4010",upstream:"https://api.example.com/v1"});
  assert.equal(routed.url,"http://127.0.0.1:4010/users?limit={{limit}}");
  assert.equal(original.url,"{{baseUrl}}/users?limit={{limit}}");
});

test("Ride rewrites absolute upstream URLs and preserves query strings", async () => {
  const { proxyRequestUrl } = await import("../src/ui/ride-proxy.mjs");
  assert.equal(
    proxyRequestUrl("https://api.example.com/v1/items?q=1","http://127.0.0.1:4010","https://api.example.com/v1"),
    "http://127.0.0.1:4010/items?q=1"
  );
});

test("Ride rejects unrelated hosts and unmapped variable URLs", async () => {
  const { proxyRequestUrl } = await import("../src/ui/ride-proxy.mjs");
  assert.throws(()=>proxyRequestUrl("https://evil.example/items","http://127.0.0.1:4010","https://api.example.com"),/Upstream/);
  assert.throws(()=>proxyRequestUrl("{{OTHER_URL}}/users","http://127.0.0.1:4010","https://api.example.com"),/baseUrl/);
  assert.throws(()=>proxyRequestUrl("https://api.example.com/v2/items","http://127.0.0.1:4010","https://api.example.com/v1"),/Upstream/);
  assert.throws(()=>proxyRequestUrl("https://api.example.com/items","https://remote.example", "https://api.example.com"),/로컬/);
});

test("Ride resolves the default symbolic Mock Proxy upstream from the environment", async () => {
  const { resolveRideUpstream, proxyRequestUrl } = await import("../src/ui/ride-proxy.mjs");
  const upstream = resolveRideUpstream("{{baseUrl}}/v1", {baseUrl:"https://api.example.com"});
  assert.equal(upstream, "https://api.example.com/v1");
  assert.equal(proxyRequestUrl("https://api.example.com/v1/items","http://127.0.0.1:4010",upstream),"http://127.0.0.1:4010/items");
  assert.equal(resolveRideUpstream("{{baseUrl}}", {baseURL:"https://api.example.com"}),"https://api.example.com");
  assert.throws(()=>resolveRideUpstream("{{baseUrl}}", {}),/baseUrl/);
});
